# WebGL backend design (full rewrite)

**Date:** 2026-05-03
**Status:** Spec — exploratory; not scheduled. If pursued, scoped as a full
rewrite of the renderer, not an incremental migration.

## Problem

weasel renders through Canvas 2D end-to-end. The `RenderLayer.draw` API,
the path tracing helpers, paint application, text rendering, hit-test
visualization, debug overlays, and consumer-supplied draw callbacks all
assume `CanvasRenderingContext2D`. This is fine for the current target
(interactive scenes with dozens to a few hundred objects, infrequent
repaints), but caps the kit's capacity ceiling:

- Scenes above ~5000 items drop frames during pan/zoom.
- Per-pixel effects (gradients along arc, glow, displacement, particle
  systems, masks) require expensive workarounds or are impossible in 2D.
- Sustained 60fps animation across many objects is out of reach.
- Compositing many translucent layers gets expensive linearly.

A WebGL backend solves all of these — at the cost of a full renderer
rewrite. This spec scopes that rewrite.

## Goal

Replace Canvas 2D as weasel's primary rendering backend with WebGL2.
Maintain the kit's value proposition (declarative scene graph, generic
adapters, narrow public API) while dramatically expanding the perf and
visual-effect ceiling.

This is a "if we did it, here's what it would be" spec — explicit non-goal
is to schedule it. The decision to commit needs a forcing function (a real
consumer hitting the 2D wall, or a strategic bet on GPU-only effects as
core).

## Why a full rewrite, not incremental

A `<canvas>` element holds **one** context type — 2D or WebGL, never
both. The "stack two canvases" approach (one 2D, one WebGL, composed via
DOM) works for adding GL as an opt-in *layer type* but breaks down as a
backend-replacement strategy:

- Z-order constrained by DOM stacking; can't interleave 2D and WebGL
  layers freely
- Memory cost doubles at high DPR
- Two coordinator paths (2D and GL) means two RenderLayer signatures,
  two renderer codebases, two test suites — the very fragmentation the
  rewrite would justify

If we're paying the cost of a GL renderer, the right move is to commit
fully and delete the 2D path. Anyone wanting "2D plus GL effect on top"
gets it via a single GL renderer that happens to have a 2D-flavored
high-level API. Anyone wanting a single GL effect without committing to
the full rewrite stays on the (existing) 2D backend with a
`createWebGLLayer` opt-in approach (sketched in earlier discussion;
parallel design, not part of this spec).

## Architecture

### RenderLayer signature change

The current `RenderLayer.draw(ctx: CanvasRenderingContext2D, data, view, dims)`
becomes one of these (pick at design close):

#### Option A — declarative draw commands (recommended)

Layers emit a tree of high-level commands; the renderer interprets them.

```ts
type DrawCommand =
  | { kind: 'path'; path: Path; fill?: Paint; stroke?: Stroke }
  | { kind: 'text'; x: number; y: number; text: string; style: TextStyle }
  | { kind: 'image'; image: ImageBitmap; x: number; y: number; w: number; h: number }
  | { kind: 'group'; transform?: Matrix; alpha?: number; children: DrawCommand[] }
  | { kind: 'shader'; program: ShaderProgram; uniforms: Record<string, unknown>; geometry: Geometry };

interface RenderLayer<TData> {
  id: string;
  space: 'world' | 'screen';
  draw: (data: TData, view: View, dims: Dims) => DrawCommand[];
}
```

Pros: consumers stay declarative; renderer batches/state-sorts/instances
across layers; testing is pure (assert against returned command tree, no
ctx mocking). Cons: `kind: 'shader'` opens an escape hatch that some
consumers will reach for and become coupled to.

#### Option B — high-level imperative API

Layers receive a `WeaselRenderContext` with `drawPath`/`drawText`/
`drawImage`/`pushTransform`/`popTransform`/etc. Looks like 2D
conceptually, runs on GL underneath.

Pros: minimal mental shift for consumers porting from 2D draw functions.
Cons: imperative API limits batching across layers; testing requires a
full ctx mock; renderer state is harder to optimize.

#### Recommendation: A

The declarative form aligns with the kit's general philosophy (scene
graph, narrow surface, layers as data) and unlocks meaningful renderer
optimizations later (dirty-region rendering, frame caching, instancing).
B is faster to migrate to but caps the renderer's potential.

### Renderer responsibilities

The single GL renderer (`WeaselRenderer` or similar) owns:

- WebGL2 context lifecycle: creation, loss/restore, resize, DPR.
- Shader programs: a small set of built-ins (path-fill, path-stroke,
  textured-quad for text/image, generic shader for `kind: 'shader'`
  commands) with hot-swap recompilation in dev.
- Geometry caches: tessellated meshes per Path, keyed by path identity +
  transform-invariants. Invalidate on Path change; reuse across frames.
- Texture caches: text glyph atlas, image uploads, gradient ramps.
- Draw-call batching: same-program / same-uniforms commands batched into
  one call where possible. Z-order via `gl_FragDepth` or sort-on-CPU.
- State management: software state stack to mirror `pushTransform` /
  `pushAlpha` semantics; minimize gl state changes per frame.
- Frame composition: takes the layer pipeline, renders to the main
  framebuffer (or to an offscreen for picking).

### Path rendering

No native path API in WebGL. Build a `tessellatePath(path: Path): Mesh`
helper:

- Polygons → triangulate via earcut (small, fast, MIT) for fills with
  `nonzero` winding. For `evenodd`, two-pass with stencil.
- Curves (Q/C) → flatten to line segments via adaptive subdivision
  (de Casteljau with curvature tolerance), then earcut.
- Strokes → expand polyline to ribbon mesh (caps, joins, miter limits
  computed CPU-side). Dash patterns by inserting gaps in the ribbon
  geometry.
- Cache the mesh on the Path object's identity (WeakMap). Invalidate
  when consumers create a new Path.

### Text rendering

The single biggest project inside the rewrite. Decision required at
design close. Three viable paths:

1. **MSDF font atlas (recommended).** Preprocess each font face into a
   multi-channel signed-distance field at build time. Render text as
   textured quads using a fragment shader that reads the SDF for
   crisp scaling. Quality at any zoom level, near-2D parity for body
   text, free arbitrary scaling and rotation. Cost: build pipeline,
   one-time per font; ~50–200KB per atlas.
2. **Texture-per-string.** Render each unique string to a 2D canvas, upload
   as a texture. Simple but reupload cost is real for dynamic text;
   cache hit rate matters.
3. **Pull in a library** like troika-three-text or sdf-text. Saves work,
   adds bundle weight (~200KB), couples to the library's API.

Recommend (1). Ship one default font (system-stack fallback), let
consumers register additional faces via `registerFont(family, atlasUrl)`.

### Hit-testing

Move off `isPointInPath` / `isPointInStroke` entirely. Implement CPU-side:

- `pointInPath(point, path, fillRule)` — winding number on tessellated
  polygons; cached.
- `pointNearStroke(point, path, width)` — distance-to-segment, accounting
  for caps and joins.

These are also useful as standalone utilities (debug overlays, custom
hit-tests in consumer code), so they ship as exports regardless.

### Compositing

`globalAlpha` → uniform per draw. `globalCompositeOperation` for the
common cases:
- `source-over` → standard alpha blend (default)
- `multiply`, `screen`, `lighter`, `darken`, `lighten` → gl blend modes
- `xor`, exotic Porter-Duff modes → framebuffer pingpong (deferred;
  most consumers don't need them)

### DPI / sizing

WebGL handles DPR via `drawingBufferWidth/Height`. The current
`setupCanvasDpr` 2D-context transform helper is removed; the renderer
owns this end-to-end.

### Context loss handling

GL contexts can be lost (tab backgrounded for too long, GPU reset,
"too many contexts"). The renderer registers
`webglcontextlost`/`webglcontextrestored` handlers and reuploads all
textures/buffers on restore. Consumers don't see this — paths and
text re-tessellate transparently. This is a correctness requirement,
not a feature.

### Public API impact

- `RenderLayer.draw` signature changes — every existing layer needs
  porting.
- `traceToContext`, `applyPaint`, `applyStroke` — removed (their job
  becomes the renderer's).
- `createPathLayer`, `createTextLayer`, `createGridLayer`, etc. —
  rewritten internally to emit DrawCommand trees instead of imperative
  ctx calls. External signatures preserved where possible.
- `setupCanvasDpr`, `useFixedPixelRatio` — removed; renderer owns DPR.
- Path/Paint/Stroke/TextStyle types — preserved, since they're
  representation-only.

### What stays unchanged

- The Tool primitive (gestures, scratch, slots, overlay channel) is
  pure interaction logic; no rendering inside.
- The scene graph, adapter pattern, op model — orthogonal to the
  renderer.
- The viewport math (`worldToScreen` / `screenToWorld` / `View`) —
  unchanged.
- Layer composition pipeline (layers ordered, runLayers iterates) —
  same shape, different leaf invocation.

## Performance impact

Order-of-magnitude estimates for typical interactive scenes (60fps =
16ms/frame budget):

| Scene | Canvas 2D today | WebGL2 (good impl) | Verdict |
|---|---|---|---|
| 50 simple rects + text | ~1ms | ~0.5ms | Imperceptible difference. |
| 500 rects, redraw on pan | ~5–8ms | ~1ms | Win, but 2D is fine. |
| 5,000 items, no animation | ~30–50ms (drops frames) | ~2–3ms | Real win. |
| 50,000 items via instancing | unusable | ~5ms | Game-changing. |
| 100 complex paths, redraw per frame | ~10–20ms | ~3–5ms (post-cache) | Modest win once cached; first frame after path edit can be slower. |
| 1000 dynamic strings/frame | ~5ms | atlas-dependent; can be slower naive | Tie or loss without serious atlas engineering. |
| Gradient-heavy fills | ~15ms+ | ~1ms | Big win. |

**Where you definitely lose:**
- Initial page load: shader compile + atlas build adds 200–500ms before
  first frame.
- Memory at high DPR: real (tens to hundreds of MB for atlases +
  framebuffers).
- "Print one chart and stop" use cases: 2D is faster end-to-end.
- Bundle size: ~100–300KB added (renderer + tessellation + atlas tooling).

**Where you definitely win:**
- Per-pixel effects (gradients along arc, glow, displacement, masks).
- High object counts (5000+).
- Sustained 60fps animation.
- Many overlapping translucent items.

## Cost

- **4–8 weeks of focused work** for parity, dominated by text rendering
  and path tessellation.
- Test suite mostly rewritten — many current tests assert against ctx2d
  call sequences. Replace with assertions against DrawCommand trees,
  which is cleaner long-term.
- Every external consumer with a custom RenderLayer rewrites their
  `draw`. Mitigated by Option A's command tree being mechanically
  derivable from many existing 2D draw functions (a codemod could
  cover the common cases).
- High risk of subtle visual regressions: antialiasing differences,
  glyph hinting, line cap/join geometry. Browser-by-browser tuning
  likely.
- Path-flavored features (fillRule, dash patterns, miter limits) need
  careful re-implementation against the new tessellator.
- Hit-testing migrates to pure CPU — happens to be cleaner and more
  testable; partial win.

## Migration sequencing (if pursued)

1. Stand up a minimal renderer in a parallel package (`@orochi235/weasel-gl`)
   that handles solid-fill paths only. Test against synthetic scenes.
2. Add stroke support (ribbon expansion, basic caps/joins).
3. Add text via MSDF atlas of one default font.
4. Add image/pattern/gradient support.
5. Port `createPathLayer`, `createTextLayer`, `createGridLayer`,
   `createSelectionOverlayLayer`, `createCellHighlightLayer`,
   `createChildrenLayer`, `createPenPreviewLayer` one at a time.
6. Port the Canvas component to use the new renderer; keep 2D Canvas as
   a fallback prop (`backend: '2d' | 'gl'`) during the soak period.
7. Port every demo. Visual diff against 2D baseline; tune until parity.
8. Delete the 2D backend and `backend` prop. Rename `weasel-gl` →
   `weasel` (or absorb back into core).

This is presented in the order it'd ship. Each step is independently
testable and (mostly) reversible.

## What this is NOT

- Not WebGPU. WebGL2 is the target — broader support, mature ecosystem,
  simpler API. WebGPU graduates from "shiny" to "default" in another
  2–3 years; revisit then.
- Not a per-layer opt-in. That's the parallel "add GL as a layer type"
  approach (a separate, much cheaper design). This spec is the full
  swap.
- Not aimed at solving any specific feature gap (per-point coloring,
  blur, etc.). Those become trivial once GL is the backend, but the
  spec is justified by capacity, not features.

## Decision criteria — when to actually do this

Go when at least two are true:

- A real consumer (or weasel demo) regularly handles >2000 items and
  chokes on Canvas 2D.
- GPU-only effects (shaders, particles, displacement, blur) become a
  product requirement, not a wishlist.
- Sustained 60fps animation across many items becomes a regular
  pattern in the kit's use cases.
- Mobile / high-DPR-laptop performance becomes a measured pain point.

Until then: ship 2D, build the per-layer GL opt-in (separate spec) for
specific effects, and revisit.

## Tests required

A backend rewrite is the moment to upgrade test rigor:

- Visual regression tests against a baseline (golden-image diffs per
  demo). Today none exist; the rewrite needs them.
- Tessellation tests: every Path shape (polygon, evenodd, with curves)
  produces a triangulation that covers the same pixels as the 2D
  reference (within a tolerance).
- Stroke tests: cap shapes, join geometry, dash patterns visually
  matching 2D reference within tolerance.
- Text tests: glyph positioning/metrics matching 2D's `measureText`
  within sub-pixel.
- Hit-test tests: existing isPointInPath/isPointInStroke tests
  re-targeted to the new CPU implementations.
- Context-loss tests: simulate `WEBGL_lose_context` extension; assert
  re-render after restore matches pre-loss frame.

## Deferred / out of scope (logged in `docs/TODO.md`)

- WebGPU backend after WebGL is shipped (separate, future spec).
- Worker-thread offload (OffscreenCanvas + render in worker) — a major
  perf win but adds significant API complexity (Transferable, message
  passing). Defer until single-thread GL is shipped and measured.
- Print/SVG export. The 2D backend trivially supports these via context
  swap; GL doesn't. Need a parallel SVG export path or 2D fallback for
  export.
- Custom shader API for consumers. The `kind: 'shader'` DrawCommand
  exists but its public surface (program registration, uniform
  binding) needs its own design pass.
- Exotic composite ops (xor, etc.) — framebuffer pingpong implementation
  deferred; ship without them initially.
- IE / WebGL1 fallback. Out of scope; WebGL2 only.
- Headless server-side rendering (Node + headless-gl) — possible but
  not a v1 commitment.

## Migration notes

- Project policy: breaking changes are free; no compat shim.
- Plan in two phases: (1) standalone `weasel-gl` package implementing the
  renderer until parity, (2) flip the switch — delete 2D, rename `weasel-gl`
  back, port demos. Keeps the bet cheap to abandon mid-flight.
- Ship behind a `backend` prop on Canvas during the soak. Defaults flip
  from `'2d'` to `'gl'` only after every demo passes visual diff.
