# WebGL transition plan

**Date:** 2026-05-08
**Status:** Scheduled — execution plan committed; sequencing balanced.
**Supersedes status of:** [`docs/specs/2026-05-03-webgl-backend-design.md`](../../specs/2026-05-03-webgl-backend-design.md) (architectural source; this doc closes its open decisions and adds execution detail).

## Relation to the May 3 spec

The May 3 WebGL backend design remains the architectural source. It commits to:

- Full renderer rewrite, not incremental layered approach
- WebGL2 (not WebGPU; revisit in 2–3 years)
- Declarative `DrawCommand` tree as the layer→renderer interface
- MSDF font atlases for text
- CPU-side hit-testing (`pointInPath`, `pointNearStroke`)
- Parallel package strategy: build `@weasel-js/gl` to parity, then flip
- Path identity-keyed mesh caches; gradient-ramp / atlas / texture caches
- Context-loss handling as a v1 correctness requirement

This doc moves the May 3 spec from "exploratory; not scheduled" to "scheduled; transition plan committed," closes its open decisions, and adds the concrete pieces it deferred (sequencing detail, public shader API surface, visual-regression rig, rollback path per phase).

## Forcing function

Strategic readiness — no specific consumer is hitting the 2D wall today. The transition is sequenced for steady progress, not urgency. The parallel-package strategy keeps it cheap to abandon mid-flight: steps 1–7 leave `@weasel-js/core` 2D untouched, so abandonment costs only the work invested in `weasel-gl`.

## Closed decisions

| # | Decision | Choice |
|---|---|---|
| 1 | RenderLayer signature | **Declarative DrawCommand tree** (Option A from May 3 spec). Layers return a tree of high-level commands; renderer batches/state-sorts/instances. Includes `kind: 'shader'` variant. |
| 2 | Text rendering | **MSDF font atlas**, built via `msdf-bmfont-xml`. Default font ships prebuilt; consumers register more via `registerFont(family, atlasUrl)`. Complex-script shaping (HarfBuzz integration) deferred. |
| 3 | Custom shader public API scope | **Minimal v1, marked experimental.** `registerProgram(id, vert, frag)` + small uniform type map, single geometry source ("auto-quad over command bounds"), `@experimental` JSDoc. Tightened from real usage in v2. |
| 4 | Built-in effect vocabulary in v1 | **Parity + free GL wins.** Match 2D, plus extend `Paint` with linear/radial/conic gradients, add per-vertex colors (Path attribute), add `colorMatrix` group attribute. Defer FBO-based effects (drop shadow, glow, blur, masks) to v2. |
| 5 | Transition strategy | **Parallel `@weasel-js/gl` package → soak via `backend: '2d' \| 'gl'` prop → flip default → delete 2D and rename.** |
| 6 | Visual regression rig | **Playwright + pixelmatch**, locked to a single CI runner image (Linux + headless Chromium). Per-pixel sensitivity `pixelmatch({ threshold: 0.1 })`; pass criterion `mismatched / total < 0.02` (≤ 2% of pixels may differ). Baselines committed; updates only via `pnpm test:visual:update`. |

## Architecture deltas from May 3 spec

The May 3 spec stands. This section pins down the surfaces the closed decisions add or refine.

### `DrawCommand` union (final shape)

```ts
type DrawCommand =
  | { kind: 'path'; path: Path; fill?: Paint; stroke?: Stroke; vertexColors?: number[] }
  | { kind: 'text'; x: number; y: number; text: string; style: TextStyle }
  | { kind: 'image'; image: ImageBitmap; x: number; y: number; w: number; h: number }
  | { kind: 'group'; transform?: Matrix; alpha?: number; colorMatrix?: number[]; children: DrawCommand[] }
  | { kind: 'shader'; program: ShaderProgramHandle; uniforms: Record<string, ShaderUniform>; bounds: Rect };
```

- `vertexColors` is an optional flat RGBA-per-vertex array on the `kind: 'path'` *DrawCommand variant* (not on `Path` itself — Paths are cached by identity and may be drawn with different per-vertex tints across frames).
- `colorMatrix` is a 4×4 matrix on `group` (identity if absent), applied as a fragment-shader uniform — *not* a new DrawCommand kind.
- `kind: 'shader'` carries an opaque `ShaderProgramHandle` from `registerProgram` and a `bounds` rect for the auto-generated quad geometry.

### `Paint` type extension

```ts
type Paint =
  | { fill?: 'solid'; color: string; opacity?: number }                                              // existing
  | { fill: 'pattern'; pattern: CanvasPattern; opacity?: number }                                    // existing
  | { fill: 'linear-gradient'; from: Point; to: Point; stops: GradStop[]; opacity?: number }         // new
  | { fill: 'radial-gradient'; center: Point; radius: number; stops: GradStop[]; opacity?: number }  // new
  | { fill: 'conic-gradient'; center: Point; angle: number; stops: GradStop[]; opacity?: number };   // new

interface GradStop { offset: number; color: string; }
```

`pattern` keeps `CanvasPattern` for source compatibility; the renderer reads its image and repetition mode and re-binds as a GL texture.

### What stays unchanged

- `Scene`, adapters, ops, history
- Tool primitive (gestures, scratch, slots, overlay channel)
- Viewport math (`View`, `worldToScreen`, etc.)
- `Path`, `Stroke`, `TextStyle` types

## Sequencing

Ten steps. Each is independently testable. Steps 1–7 ship inside `weasel-gl` only; the existing `weasel` 2D path is untouched until step 8.

> **Note on `kind: 'shader'` timing.** The DrawCommand type union is finalized at step 1 with all its variants — including `kind: 'shader'` — so the renderer's internal architecture is shaped to handle them from day one. But the consumer-facing `registerProgram` (the only way to obtain a `ShaderProgramHandle`) doesn't land until step 6. Between steps 1 and 5, `kind: 'shader'` exists in the type but is unreachable from consumer code; the renderer's own infrastructure uses the same shader-program internals to implement built-ins.

| # | Scope | Exit criterion | Key risk |
|---|---|---|---|
| 1 | **Solid-fill paths.** WebGL2 context lifecycle (creation, resize, DPR, loss/restore). Tessellator (earcut for `nonzero`; stencil two-pass for `evenodd`). Path mesh cache (WeakMap on Path identity). Built-in path-fill shader. DrawCommand interpreter for `kind: 'path'` with solid `Paint` only. | Synthetic test scenes (10 / 100 / 1000 polygons; nested groups with transform + alpha) render correctly under all three winding cases. Tessellation tests in unit suite. | Polygon-with-curves flattening tolerance — get it wrong and curves visibly polygonize at high zoom. Use adaptive de Casteljau with curvature tolerance keyed to view scale. |
| 2 | **Strokes.** Ribbon-mesh expansion (CPU-side caps, joins, miter limits). Dash patterns via geometry gaps. Built-in stroke shader. Honor `StrokeAlign` (`center` / `inner` / `outer`). | Stroke unit tests cover round/butt/square caps, miter/round/bevel joins, dash patterns. Visual checks vs Canvas 2D reference within 2px tolerance. | Miter-limit geometry edge cases. Inner/outer stroke alignment for arbitrary paths needs stencil masking, not just shifted geometry. |
| 3 | **Text (MSDF).** Build pipeline: `pnpm gen:font` script wrapping `msdf-bmfont-xml`. Default font ships prebuilt (JSON metrics + PNG atlas under `weasel-gl/fonts/`). SDF fragment shader. Glyph layout (ASCII + Latin-1 + CJK base via the atlas; complex scripts deferred). `registerFont(family, atlasUrl)`. | `kind: 'text'` renders crisp at multiple zoom levels. Metrics match `measureText` baseline within sub-pixel. Atlas misses log a clear warning and render a `?` fallback glyph. | Subpixel positioning for body text. Vertical metric mismatch vs 2D's `textBaseline`. |
| 4 | **Image, pattern, gradient.** Image upload + cache. Pattern recreated from `CanvasPattern.image`. Linear/radial/conic gradients via gradient-ramp texture (uploaded once per unique stop array, keyed by hash). Extends `Paint` type — visible in `weasel-gl`'s exports, not `weasel`'s yet. | Each Paint variant renders correctly. Gradient ramp cache hit rate > 95% in soak demo. | Pattern transform under high-DPR. Conic gradient angle wrap. |
| 5 | **Per-vertex colors + color matrix.** `Path.vertexColors` honored by path-fill shader (vertex attribute → fragment varying). Group's `colorMatrix` applied as 4×4 fragment uniform. | Test scenes: gradient-along-path via per-vertex colors, hue-rotated subtree via colorMatrix. | None significant — both are small uniform/attribute additions. |
| 6 | **Minimal experimental shader API.** `registerProgram(id, vert, frag): ShaderProgramHandle`, returns opaque handle or throws on compile-fail with shader log. Uniform map: `number`, `vec2..4`, `mat3`, `mat4`, `texture`. Geometry: auto-generated quad over `bounds` rect. Fixed vertex-shader prelude exposing `v_uv` / `v_screen` / `v_world` varyings. JSDoc `@experimental`. | Demo: a custom fragment shader (Voronoi noise) renders inside a bounded rect with mouse-position uniform updates. Compile-fail produces a thrown error consumers can catch. | Texture handle lifecycle (consumer-owned vs renderer-owned) — pick renderer-owned via `registerTexture`. |
| 7 | **Port built-in layers.** `createPathLayer`, `createTextLayer`, `createGridLayer`, `createSelectionOverlayLayer`, `createCellHighlightLayer`, `createChildrenLayer`, `createPenPreviewLayer`, `createDebugOverlayLayer`. Each rewritten to emit DrawCommand trees. External signatures preserved. | All built-in layer unit tests rewritten to assert against returned DrawCommand trees instead of ctx mocks. Pure functions; no GL context needed in unit suite. | Test rewrites are mechanical but voluminous. Triple-check overlay z-order parity. |
| 8 | **Canvas component port.** `<Canvas>` (and `<SceneCanvas>`) accept `backend?: '2d' \| 'gl'`. Default `'2d'` initially. GL backend instantiates `WeaselRenderer`; 2D backend keeps the current `drawLayers` path. `setupCanvasDpr` removed from the GL path; renderer owns DPR. | Demo runs identically under `backend='2d'` and `backend='gl'` (eyeball at this stage; visual rig lands in step 9). | A `<canvas>` element holds one context type for life — switching `backend` requires a remount. Document; emit a console warning if changed at runtime. |
| 9 | **Visual regression + demo soak.** Stand up Playwright + pixelmatch rig. Capture per-demo baseline PNGs under `backend='2d'`. Switch demos one at a time to `backend='gl'`; iterate until each demo's diff ≤ 2% pixel. Land baselines in git; CI runs on every PR. Default `backend` flips to `'gl'` once all demos green. | Every demo passes visual diff under `backend='gl'` against its 2D baseline. 30 days of `'gl'` default in the published demo site without a regression bug filed. | Cross-platform pixel determinism is bad; CI must lock to one runner image. Some tolerances may need to push above 2%. |
| 10 | **Final swap.** Delete 2D codepath: `paint.ts` (2D `applyPaint`/`applyStroke`), `setupCanvasDpr`, `RenderLayer.draw(ctx, …)` 2D signature. Drop `backend` prop. Rename `@weasel-js/gl` → fold back into `@weasel-js/core`. Bump major version, write changeset, update README. | `weasel` ships as GL-only. No `CanvasRenderingContext2D` references in `src/`. Bundle size delta documented. | Consumers with custom RenderLayers must port. Provide migration guide + codemod for common patterns. |

## Public API contract for v1 (after step 10)

External signatures of `create*Layer` factories are preserved; their internals are all rewritten. Breaking changes are concentrated in `RenderLayer` and the removal of imperative-ctx helpers.

### Added

```ts
export type DrawCommand = /* the union above */;
export interface ShaderProgramHandle { readonly id: string; /* opaque */ }
export interface TextureHandle { readonly id: string; /* opaque */ }
export type ShaderUniform =
  | number
  | [number, number]
  | [number, number, number]
  | [number, number, number, number]
  | Float32Array            // length 9 (mat3) or 16 (mat4)
  | TextureHandle;

export function registerFont(family: string, atlasUrl: string): Promise<void>;

/** @experimental API may break before v2. See `docs/shader-api.md`. */
export function registerProgram(id: string, vert: string, frag: string): ShaderProgramHandle;

export function registerTexture(image: ImageBitmap | HTMLImageElement): TextureHandle;

export function pointInPath(point: Point, path: Path, fillRule?: 'nonzero' | 'evenodd'): boolean;
export function pointNearStroke(point: Point, path: Path, width: number): boolean;
```

### Changed

```ts
// Was: draw: (ctx: CanvasRenderingContext2D, data, view) => void
export interface RenderLayer<TData> {
  id: string;
  label: string;
  draw: (data: TData, view: View, dims: Dims) => DrawCommand[];
  defaultVisible?: boolean;
  alwaysOn?: boolean;
  space?: 'world' | 'screen';
}

// Paint: gains gradient variants (see above)
// Path type: unchanged. Per-vertex colors live on the `kind: 'path'`
// DrawCommand variant, not on Path itself.
```

### Removed

```ts
// 2D-only — deleted in step 10:
applyPaint, applyStroke, renderFilledRegion        // ctx state mutators
setupCanvasDpr, useFixedPixelRatio                 // DPR helpers — renderer owns DPR now
```

### Preserved (signatures unchanged; internals rewritten)

`createPathLayer`, `createTextLayer`, `createGridLayer`, `createSelectionOverlayLayer`, `createCellHighlightLayer`, `createChildrenLayer`, `createPenPreviewLayer`, `createDebugOverlayLayer`. `Scene`, `applyOps`, all op factories, history primitives. All Tool primitives, gestures, dispatcher. `View`, `worldToScreen`, `screenToWorld`, viewport hooks. `Path`, `Stroke`, `TextStyle` types.

### Soak-period prop

During steps 8–9: `<Canvas>` / `<SceneCanvas>` accept `backend?: '2d' | 'gl'`. Default `'2d'` then flips to `'gl'`. Switching after mount requires remount; runtime change emits a console warning. Removed entirely in step 10.

## Custom shader API (experimental v1)

The smallest surface that lets consumers run their own fragment shaders against a bounded rect, marked `@experimental` so we can revise without a major version bump.

### Vertex shader contract (kit-supplied)

The kit prepends a fixed vertex shader prelude:

```glsl
#version 300 es
in vec2 a_position;        // -1..1 quad
in vec2 a_uv;              // 0..1
uniform vec4 u_bounds;     // x, y, w, h in screen coords
uniform mat3 u_view;       // weasel View matrix
out vec2 v_uv;             // 0..1 across the bounds rect
out vec2 v_screen;         // screen-space pixel coord at this fragment
out vec2 v_world;          // world-space coord at this fragment
```

Consumers write only the fragment shader. They receive the documented varyings and `u_bounds`. Internal coord-system plumbing is *not* part of the public contract — we can rework it in v2 without breaking consumer fragment shaders that only consume documented varyings.

### Use site

```ts
const program = registerProgram('my-noise', '', /* default vert */ `
  #version 300 es
  precision highp float;
  in vec2 v_uv;
  uniform float u_time;
  out vec4 outColor;
  void main() {
    outColor = vec4(fract(sin(dot(v_uv * u_time, vec2(12.9898, 78.233))) * 43758.5453), 0.0, 0.0, 1.0);
  }
`);

// in a layer's draw():
return [{
  kind: 'shader',
  program,
  uniforms: { u_time: performance.now() / 1000 },
  bounds: { x: 100, y: 100, w: 200, h: 200 },
}];
```

### Behavior

- **Compile failure:** `registerProgram` throws `ShaderCompileError { kind: 'vertex' | 'fragment' | 'link', log: string }`.
- **Re-registration:** in dev mode, calling with a known id replaces the program (hot-reload). In prod, throws.
- **Missing uniform at draw time:** silently ignored (matches GL); logs once per `(program, uniform)` in dev.
- **Type mismatch:** throws in dev, ignored in prod.
- **Disposal:** programs live for renderer lifetime; no explicit destroy in v1 (renderer disposal frees them).

### Deferred to v2 shader API spec

Consumer-supplied geometry (custom buffers, instancing). Custom vertex shaders beyond the default prelude. Multi-pass rendering / render-to-texture surfaces consumers can sample. Kit-managed time/frame uniforms. `unregisterProgram(handle)`. Source map / line-number reporting for shader errors.

## Visual regression rig

Lands in step 9. Required green before the default `backend` flips to `'gl'`.

### Stack

- `@playwright/test` — drives a real Chromium against the demo dev server.
- `pixelmatch` — diffs captured PNGs against committed baselines.
- A tiny harness (`tests/visual/diff.ts`) that wraps `await page.locator('canvas').screenshot()` + `pixelmatch`.

### CI image pinning

Visual tests run only on `ubuntu-22.04` GitHub-hosted runners (or one self-hosted Linux image — pick one). Baselines are *not* portable across macOS / Windows / different Linux images. The workflow file pins the runner image explicitly and fails loudly if it's changed. Document the constraint loudly in `CONTRIBUTING.md`.

### Layout

```
tests/visual/
  baselines/                     # committed PNGs, ~30–80KB each
    rectangle-demo.png
    nested-groups-demo.png
    viewport-demo.png
    pen-tool-demo.png
    …
  diff.ts                        # tiny harness
  *.spec.ts                      # one spec per demo
  playwright.config.ts
```

### Tolerance

Default `pixelmatch({ threshold: 0.1 })` and pass criterion `mismatched / total < 0.02` (2%). Per-demo overrides allowed with a code-comment justification (e.g. text-heavy or gradient-heavy regions may push to 5%).

### Update workflow

```jsonc
// package.json scripts
"test:visual": "playwright test --config=tests/visual/playwright.config.ts",
"test:visual:update": "playwright test --config=tests/visual/playwright.config.ts --update-snapshots"
```

When a code change intentionally alters output, the developer runs `test:visual:update`, reviews the resulting PNG diff in the PR, and commits the updated baselines. CI never auto-updates. Baseline updates ideally run in CI (or in a Docker container matching the CI image) to avoid local-machine drift.

### Coverage

Every demo in `demo/demos/` (one spec per demo). Each spec boots the dev server, navigates to the demo, performs a small scripted interaction sequence (click here, drag there) that exercises the demo's main paths, captures the canvas after each step, and compares against baselines.

### Out of scope for the rig

Animation timing (frame-by-frame visual diff of running animations) — captures static end-states only. Cross-platform pixel comparison — explicitly omitted per runner pinning. Real-device perf measurement — separate harness if/when needed.

## Risks & rollback

The May 3 spec covers architectural risk. This section focuses on transition-execution risk.

| Risk | Mitigation | Rollback / fallback |
|---|---|---|
| **Visual baselines drift across machines** | CI runner pinned; baselines updated only by `test:visual:update` run in CI (or in a Docker image matching CI). Documented in `CONTRIBUTING`. | Per-test tolerance loosens with code-comment justification; ratchet back when feasible. |
| **Bundle size regression** (May 3 estimates +100–300KB; easy to overshoot) | CI step from step 1 onward emits production bundle on every PR; fails if delta > 50KB without a `CHANGELOG` entry. | If genuinely too heavy at step 9, accept and publish notes, or split shader API + MSDF text into subpath imports. |
| **Initial-frame latency regression** (shader compile + atlas fetch +200–500ms vs Canvas 2D) | Document in migration guide. `registerFont` is async; renderer renders text-without-atlas (fallback solid color) until atlas loads, then re-renders. | Acceptable; documented. Consumers preload via `<link rel="preload">` if needed. |
| **External consumer custom RenderLayers break** | Migration guide + codemod for common patterns lands with step 10. Two release candidates published before the major bump. | None — deliberate, communicated breaking change. Major version bump signals it. |
| **Mid-flight abandonment** | Steps 1–7 leave `weasel` untouched. Parallel package strategy is exactly what makes this cheap. | Stop work; `weasel-gl` becomes deprecated/unmaintained sibling, or unpublish + delete the package directory. `weasel` is unaffected. |
| **Soak runs indefinitely** | Step 9 hard exits: every demo's diff ≤ 2% **and** 30 days of `'gl'` default in published demo site without a regression bug filed. | If 30 days produces issues, lengthen the soak; document and continue. Step 10 cannot start before exit criteria met. |
| **Cross-browser WebGL2 quirks** (Safari historically lags) | Step 1 includes baseline manual smoke-test matrix: latest Chrome/Firefox/Safari/Edge on macOS. Document known-broken browser versions in README. | If a feature is unusably broken on a major browser, gate behind a capability check with a documented fallback. |
| **Test suite rewrite is voluminous** (May 3: most existing suite is ctx-mock-based) | Step 7 dedicated to this; expect to be the longest single step. New tests (assert against DrawCommand trees) are *cleaner* than ctx mocks. | Don't ship step 8 until step 7's port is at parity. The visual rig in step 9 provides additional safety. |
| **WebGL context loss in production** | Renderer registers `webglcontextlost`/`webglcontextrestored`; reuploads textures and re-tessellates paths transparently. Required v1 correctness, not follow-up. | Context-loss tests in unit suite simulate via `WEBGL_lose_context` extension. |

### Rollback by phase

- **Steps 1–7** (parallel package): full rollback available. `weasel-gl` deletable; `weasel` untouched.
- **Steps 8–9** (soak): rollback = revert the `Canvas` PR; `weasel` returns to pre-port state. `weasel-gl` package can stay published or be deprecated.
- **Step 10** (final swap): **no rollback**. Major version bump publishes; consumers wanting the old behavior pin the previous major. We commit to one round of patch backports on the previous major if a critical bug surfaces in the first 90 days post-swap, then EOL it.

## What stays deferred

Out of scope for v1 of this transition. Each entry is a future spec or follow-up.

- **Custom shader API v2:** consumer-supplied geometry, multi-pass rendering, render-to-texture, custom vertex shaders, kit-managed time/frame uniforms, program disposal, source-map shader errors.
- **FBO-based built-in effects:** drop shadow, outer/inner glow, gaussian blur, soft mask. Significant subproject (offscreen targets, ping-pong, sizing, perf tuning); ship from real consumer demand.
- **Complex-script text shaping:** Arabic ligatures, Devanagari conjuncts, bidi, complex emoji. Requires HarfBuzz integration (typically harfbuzzjs WASM, ~1MB). Its own design spec.
- **Animation visual diff:** rig captures static end-states only; frame-by-frame motion diff is its own subproject.
- **WebGPU backend:** post-v1 successor; future spec when WebGPU support graduates from "shiny" to "default" (2–3 years).
- **Worker-thread offload:** OffscreenCanvas + render-in-worker. Major perf win but adds Transferable / message-passing API complexity; defer until single-thread GL is shipped and measured.
- **Print / SVG export:** 2D backend trivially supports these via context swap; GL doesn't. Need parallel SVG export path or 2D fallback for export use cases.
- **Exotic Porter-Duff composite ops:** xor and friends. Framebuffer ping-pong implementation deferred; ship without.
- **Headless server-side rendering:** Node + headless-gl. Possible but not a v1 commitment.

### Explicitly out of scope (not deferred)

- IE / WebGL1 fallback. WebGL2-only; no fallback path.
