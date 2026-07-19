# Headless Render-to-Pixels Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give `@weasel-js/core` a public `renderSceneToPixels()` that rasterizes a scene-space rect to raw RGBA pixels at an explicit per-axis scale, headless (no DOM canvas on screen, zero ambient `devicePixelRatio` reads), through the same WebGL2 pipeline the on-screen view uses.

**Architecture:** A new `src/canvas/renderSceneToPixels.ts` composes existing pieces: `buildSceneViewCommands` (scene → DrawCommands under a `View` transform — `View.scale` is already per-axis `{x, y}`), `WeaselRenderer` against an injected or auto-created WebGL2 context (`WeaselRendererOptions.gl` already exists), then `gl.readPixels` + row-flip + unpremultiply. Supporting renderer work: an opt-in mipmap minification mode on `GLImageCache` (print-scale minification quality; **not** `GLTextureCache` — that's the MSDF atlas cache where mipmaps are deliberately skipped because they corrupt the SDF signal), an optional `flattenTolerance` threaded through `DrawContext` so curve tessellation is regenerated at output scale (routed through the existing transient-mesh pool, since the mesh cache is keyed by Path identity only), and a new `WeaselRenderer.dispose()` so per-call renderers don't leak GL objects on caller-owned contexts. Bitmap resolution is injectable via a new optional `NodePaintCtx` third argument on `NodeShapeEntry.paint` / `defaultDrawOne` (extracted to its own module so headless callers don't import the React tree).

**Tech Stack:** TypeScript, WebGL2 (`WeaselRenderer`), vitest + jsdom with the `makeGLRecorder` proxy stub for unit tests, Playwright (`tests/visual/`, no committed baseline) for real-GL pixel assertions.

---

## Handoff & constraints (read once)

- Spec: `docs/handoffs/2026-07-19-headless-render-to-pixels.md` (the UPDATED version — req 4 is context-level injection + lifetime/loss policy; req 6 names the mipmap + tessellation hazards; req 8 requires row-flip AND unpremultiply; determinism is same-context only, NO golden-image byte tests).
- Corrections to the handoff discovered during survey:
  - `canvas-gl.spec.ts` no longer exists (only referenced by 2026-05-09 plan docs). The real-GL spec goes in `tests/visual/` alongside the other Playwright specs.
  - The mipmap hazard applies to `GLImageCache` only. `GLTextureCache` is the MSDF font-atlas cache; its header documents that mipmaps are deliberately skipped (mipmap resampling corrupts the multi-channel SDF signal). Do not touch its filtering.
- Acceptance yardstick: after this lands, `~/src/lbx-editor/src/labelRender.ts` must be expressible as unit math + one `renderSceneToPixels` call (do NOT migrate lbx-editor in this repo; do NOT add dpi/mm/printer vocabulary).
- npm is canonical; never commit `pnpm-lock.yaml`.
- No inline styles in demo JSX; use existing demo CSS classes.
- Screen rendering behavior must not change (existing tests + visual baselines must pass untouched).

Key facts established from source (verified 2026-07-19):

| Fact | Where |
|---|---|
| `View = { x, y, scale: {x, y} }` — anisotropic already | `src/core/viewport/view.ts:17-21` |
| `buildSceneViewCommands(scene, view, drawOne, extra?)` is pure, exported | `src/canvas/sceneViewRender.ts:112-133` |
| `WeaselRendererOptions = { gl?, canvas?, width, height, dpr }`; gl-only construction supported | `src/renderer/WeaselRenderer.ts:62-68, 97-103` |
| `render()` clears to `clearColor(0,0,0,0)` → transparent default is inherent | `WeaselRenderer.ts:125, 298` |
| Blend is `ONE, ONE_MINUS_SRC_ALPHA` → framebuffer is PREMULTIPLIED | `WeaselRenderer.ts:123` |
| Viewport = `gl.viewport(0, 0, widthCss*dpr, heightCss*dpr)` | `WeaselRenderer.ts:226-228` |
| No `dispose()`/`destroy()` exists on WeaselRenderer | grep |
| `getMesh(path)` called with NO opts → fixed 0.5 world-unit tolerance; WeakMap keyed by Path identity only | `src/renderer/draw.ts:270,543,721`, `src/renderer/cache/cache.ts` |
| Transient mesh pool: `ctx.meshCache.uploadTransient(mesh)`, freed by `freeTransient()` at end of `render()` | `draw.ts:666-673`, `GLMeshCache.ts:86-108` |
| `GLImageCache.upload` = LINEAR/LINEAR, no mipmaps | `GLImageCache.ts:40-41` |
| `kit:image` painter reads global `getImageBitmap(src)`; paints grey outline placeholder when unresolved, red + slash on error | `src/canvas/NodeShape.ts:254-293` |
| `defaultDrawOne` lives in `SceneCanvas.tsx:200-225`, exported via `src/index.ts:238` | — |
| Screen dPR reads: `Canvas.tsx:1480, 1504`; `useCanvasSize.ts:20`; `sceneViewRender.ts:155` (already parametric via `dpr?`) | grep |
| Unit tests: jsdom, no real GL; `makeGLRecorder()` proxy from `src/renderer/test-utils/glRecorder.ts` records call sequences | `WeaselRenderer.test.ts` |
| Real pixels: Playwright in `tests/visual/` (`diff.ts` = screenshot+pixelmatch; specs without baselines are fine) | `tests/visual/scene.spec.ts` |
| Demo registry: `apps/site/registry.ts`, category `'Rendering & paint'` exists; entry = `{id, title, category, description, hint, Component, full, path}` | `registry.ts:451` |

---

### Task 0: Branch setup

**Files:** none (git only)

- [ ] **Step 1: Branch off main**

The repo is currently on `content-ingestion` (unmerged, unrelated scope). This work branches from `main`:

```bash
cd /Users/mike/src/weasel
git checkout main
git checkout -b headless-render-to-pixels
npm install
```

Expected: clean checkout on new branch. Do not touch `content-ingestion`.

---

### Task 1: `NodePaintCtx` — injectable bitmap resolution on the painter registry

**Files:**
- Modify: `src/canvas/NodeShape.ts`
- Test: `src/canvas/NodeShape.image.test.ts`

- [ ] **Step 1: Write the failing tests**

Append to `src/canvas/NodeShape.image.test.ts` inside the existing `describe('kit:image painter', ...)` (reuses `fakeBitmap`, `imageNode`, `POSE` fixtures already in the file):

```ts
  describe('NodePaintCtx.resolveImage', () => {
    it('uses the supplied resolver instead of the global cache', () => {
      const bmp = fakeBitmap();
      const painter = findNodeShape(imageNode('a'))!;
      const cmds = painter.paint(imageNode('a'), POSE, { resolveImage: () => bmp });
      expect(cmds).toHaveLength(1);
      expect(cmds[0]).toMatchObject({ kind: 'image', image: bmp, x: 10, y: 20, w: 30, h: 40 });
    });

    it('deterministic grey placeholder when the resolver returns undefined', () => {
      // A supplied resolver is authoritative: no global-cache read, no ambient
      // load-status read — the fallback is always the single grey outline
      // (never the error variant, which depends on ambient state).
      const painter = findNodeShape(imageNode('a'))!;
      const cmds = painter.paint(imageNode('a'), POSE, { resolveImage: () => undefined });
      expect(cmds).toHaveLength(1);
      expect(cmds[0]).toMatchObject({
        kind: 'path',
        path: { kind: 'rect', x: 10, y: 20, width: 30, height: 40 },
        stroke: { paint: { color: '#bbbbbb' }, width: 1 },
      });
    });
  });
```

- [ ] **Step 2: Run to verify failure**

Run: `npx vitest run src/canvas/NodeShape.image.test.ts`
Expected: FAIL — `paint` takes 2 args (TS error) / resolver ignored.

- [ ] **Step 3: Implement**

In `src/canvas/NodeShape.ts`, add below the imports (before `NodeShapeEntry`):

```ts
/** Optional per-call paint context, threaded through `defaultDrawOne`'s third
 *  argument. Lets a rendering entry point override ambient environment reads
 *  — the headless `renderSceneToPixels` path supplies its own bitmap resolver
 *  here so consumers reuse their own decode caches. Custom painters may
 *  ignore it entirely. */
export interface NodePaintCtx {
  /** Override bitmap resolution for image nodes. When set it is authoritative:
   *  the global `imageCache` is not consulted, and an `undefined` result
   *  paints the deterministic grey placeholder outline (never the ambient
   *  load-status error variant). */
  resolveImage?: (node: Node<unknown, string, unknown>) => ImageBitmap | undefined;
}
```

Change the `paint` signature in `NodeShapeEntry`:

```ts
  /** Emits the draw commands for the node's primary visual. `ctx` is an
   *  optional per-call paint context (see `NodePaintCtx`); painters that
   *  don't need it can keep a two-argument signature. */
  paint(node: Node<TData, string, TPose>, pose: TPose, ctx?: NodePaintCtx): DrawCommand[];
```

Rewrite `IMAGE_PAINTER.paint` (currently `NodeShape.ts:260-289`):

```ts
  paint: (node, pose, ctx) => {
    const d = node.data as { image: { src: string; opacity?: number } };
    const p = pose as RectPose;
    const bmp = ctx?.resolveImage
      ? ctx.resolveImage(node as Node<unknown, string, unknown>)
      : getImageBitmap(d.image.src);
    if (bmp) {
      return [{
        kind: 'image',
        image: bmp,
        x: p.x, y: p.y, w: p.width, h: p.height,
        ...(d.image.opacity !== undefined ? { opacity: d.image.opacity } : {}),
      }];
    }
    // Not ready — faint placeholder (grey while loading, reddish + slash on
    // error). With a caller-supplied resolver the fallback is deterministic:
    // always the plain grey outline, no ambient load-status read.
    const error = ctx?.resolveImage ? false : imageStatus(d.image.src) === 'error';
    const color = error ? '#d08a8a' : '#bbbbbb';
    const cmds: DrawCommand[] = [{
      kind: 'path',
      path: { kind: 'rect', x: p.x, y: p.y, width: p.width, height: p.height },
      stroke: { paint: { color }, width: 1 },
    }];
    if (error) {
      cmds.push({
        kind: 'path',
        path: linePath({ x: p.x, y: p.y }, { x: p.x + p.width, y: p.y + p.height }),
        stroke: { paint: { color }, width: 1 },
      });
    }
    return cmds;
  },
```

- [ ] **Step 4: Run tests**

Run: `npx vitest run src/canvas/NodeShape.image.test.ts src/canvas/NodeShape.test.ts`
Expected: PASS (including the pre-existing tests — the 2-arg call sites are still valid).

- [ ] **Step 5: Commit**

```bash
git add src/canvas/NodeShape.ts src/canvas/NodeShape.image.test.ts
git commit -m "feat(canvas): NodePaintCtx — injectable bitmap resolver on NodeShape.paint"
```

---

### Task 2: Extract `defaultDrawOne` to its own module, thread `NodePaintCtx`

`renderSceneToPixels` must call `defaultDrawOne` without importing the React component tree (`SceneCanvas.tsx`). The test file `defaultDrawOne.test.ts` already anticipates a standalone module.

**Files:**
- Create: `src/canvas/defaultDrawOne.ts`
- Modify: `src/canvas/SceneCanvas.tsx` (remove the function, import it), `src/index.ts:238`, `src/canvas/defaultDrawOne.test.ts` (import path + new test)

- [ ] **Step 1: Write the failing test**

In `src/canvas/defaultDrawOne.test.ts`, change the import to the new module and add a ctx-threading test:

```ts
import { defaultDrawOne } from './defaultDrawOne';
```

```ts
it('threads NodePaintCtx to the painter (image resolver)', () => {
  const bmp = { width: 2, height: 2, close() {} } as unknown as ImageBitmap;
  const n = node({ image: { src: 'x' } });
  const cmds = defaultDrawOne(n, POSE, { resolveImage: () => bmp });
  expect(cmds[0]).toMatchObject({ kind: 'image', image: bmp });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `npx vitest run src/canvas/defaultDrawOne.test.ts`
Expected: FAIL — module `./defaultDrawOne` not found.

- [ ] **Step 3: Create `src/canvas/defaultDrawOne.ts`**

Move the function verbatim from `SceneCanvas.tsx:200-225` (keep its full doc comment), adding the `ctx` parameter. Complete file:

```ts
/**
 * `defaultDrawOne` — the kit's default per-node draw function.
 *
 * Extracted from `SceneCanvas.tsx` so non-React callers (headless
 * rasterization via `renderSceneToPixels`) can use it without importing
 * the React component tree.
 *
 * To teach the kit about a new kind of shape, register a painter — do
 * not override `drawOne`. See `registerNodeShape` for the API and
 * priority semantics. Override `drawOne` only for cross-cutting
 * decoration (post-process every node, mix in overlays from outside
 * the per-node data, etc.).
 *
 * This function also emits an optional `data.label` overlay (sans-serif
 * 11px, top-left) on every non-text painter's output — a convenience
 * for naming zones in demos. Nodes whose painter is `kit:text` skip the
 * overlay since their content already shows.
 */
import type { Node } from 'core/scene/types';
import type { DrawCommand } from '../renderer';
import { textCommand } from 'features/text/textCommand';
import { findNodeShape, type NodePaintCtx } from './NodeShape';

export function defaultDrawOne<TData, TLayer extends string, TPose>(
  node: Node<TData, TLayer, TPose>,
  pose: TPose,
  ctx?: NodePaintCtx,
): DrawCommand[] {
  const painter = findNodeShape(node);
  const primary = painter ? painter.paint(node, pose, ctx) : [];

  // Label overlay — skipped for text nodes (their content is the label).
  const data = node.data as { label?: string; text?: string } | null;
  if (data?.label && data.text == null) {
    const p = pose as unknown as { x: number; y: number };
    primary.push(textCommand(
      p.x + 6,
      p.y + 14,
      data.label,
      { fontFamily: 'sans-serif', fontSize: 11, fill: { fill: 'solid', color: 'rgba(0,0,0,0.7)' } },
    ));
  }

  // Pose-rotation wrap moved to `wrapWithPoseRotation` in
  // `./poseRotation`, applied inside `buildSceneLayer` and the preview-
  // ghost layer so every per-node `drawOne` (consumer-supplied or
  // default) gets rotation visualization. Keeping it here too would
  // double-wrap.
  return primary;
}
```

In `SceneCanvas.tsx`: delete the function body and its doc comment (lines ~180-225), add `import { defaultDrawOne } from './defaultDrawOne';` to the import block, and keep the public surface stable with a re-export next to the other exports: `export { defaultDrawOne } from './defaultDrawOne';`. Then repoint the canonical export in `src/index.ts:238`:

```ts
export { SceneCanvas, DEFAULT_HANDLE_SIZE } from './canvas/SceneCanvas';
export { defaultDrawOne } from './canvas/defaultDrawOne';
```

- [ ] **Step 4: Sweep remaining importers**

Run: `grep -rn "defaultDrawOne" src packages apps --include='*.ts' --include='*.tsx' | grep -v "\.test\." | grep -v defaultDrawOne.ts`
Update any importer still pulling it from `'./SceneCanvas'` to `'./defaultDrawOne'` (internal uses inside `SceneCanvas.tsx` itself — e.g. `mergeLayersWithDefaults` at `SceneCanvas.tsx:236-239` — now use the import). External `@weasel-js/core` consumers are unaffected (barrel path unchanged).

- [ ] **Step 5: Run tests**

Run: `npx vitest run src/canvas/defaultDrawOne.test.ts src/canvas/SceneCanvas.test.tsx && npx tsc --noEmit`
Expected: PASS, no type errors.

- [ ] **Step 6: Commit**

```bash
git add src/canvas/defaultDrawOne.ts src/canvas/SceneCanvas.tsx src/index.ts src/canvas/defaultDrawOne.test.ts
git commit -m "refactor(canvas): extract defaultDrawOne to its own module; thread NodePaintCtx"
```

---

### Task 3: Mipmap minification option on `GLImageCache` (+ renderer option)

**Files:**
- Modify: `src/renderer/cache/GLImageCache.ts`, `src/renderer/WeaselRenderer.ts`
- Test: `src/renderer/cache/GLImageCache.test.ts`

Do NOT touch `GLTextureCache` (MSDF atlases — mipmaps deliberately excluded).

- [ ] **Step 1: Write the failing tests**

Append to `src/renderer/cache/GLImageCache.test.ts`, following the file's existing recorder/stub pattern for constructing a fake `gl` (crib the existing test setup at the top of the file):

```ts
describe('minification: mipmap', () => {
  it('uploads with LINEAR_MIPMAP_LINEAR and generates mipmaps', () => {
    const rec = makeGLRecorder();
    const cache = new GLImageCache(rec.gl, 'mipmap');
    cache.upload({}, {} as ImageBitmap);
    const names = rec.calls.map((c) => c.name);
    expect(names).toContain('generateMipmap');
    const minFilter = rec.calls.find(
      (c) => c.name === 'texParameteri' && c.args[1] === rec.gl.TEXTURE_MIN_FILTER,
    );
    expect(minFilter?.args[2]).toBe(rec.gl.LINEAR_MIPMAP_LINEAR);
  });

  it("default 'linear' behavior is unchanged (no mipmap calls)", () => {
    const rec = makeGLRecorder();
    const cache = new GLImageCache(rec.gl);
    cache.upload({}, {} as ImageBitmap);
    expect(rec.calls.map((c) => c.name)).not.toContain('generateMipmap');
  });
});
```

(If the existing file uses a hand-rolled stub instead of `makeGLRecorder`, follow the file's own pattern; import `makeGLRecorder` from `../test-utils/glRecorder` only if it drops in cleanly. If `GL_CONSTANTS` in the recorder lacks `LINEAR_MIPMAP_LINEAR`, add it there: `LINEAR_MIPMAP_LINEAR: 0x2703`.)

- [ ] **Step 2: Run to verify failure**

Run: `npx vitest run src/renderer/cache/GLImageCache.test.ts`
Expected: FAIL — constructor takes 1 arg / no mipmap calls recorded.

- [ ] **Step 3: Implement**

`GLImageCache.ts` — constructor and upload:

```ts
export type ImageMinification = 'linear' | 'mipmap';

export class GLImageCache {
  private readonly map = new WeakMap<object, WebGLTexture>();

  /** `minification` selects the MIN_FILTER strategy for uploaded textures.
   *  `'linear'` (default) is the screen path's existing behavior. `'mipmap'`
   *  generates mipmaps and filters LINEAR_MIPMAP_LINEAR — required for
   *  quality minification when a large source bitmap is drawn small (the
   *  headless print/export path); bilinear-only minification undersamples
   *  and produces moiré. */
  constructor(
    private readonly gl: WebGL2RenderingContext,
    private readonly minification: ImageMinification = 'linear',
  ) {}
```

In `upload()`, replace the MIN_FILTER line (`GLImageCache.ts:40`) and add mipmap generation before the final unbind (`:46`):

```ts
    gl.texParameteri(
      gl.TEXTURE_2D,
      gl.TEXTURE_MIN_FILTER,
      this.minification === 'mipmap' ? gl.LINEAR_MIPMAP_LINEAR : gl.LINEAR,
    );
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);

    const [wrapS, wrapT] = wrapModes(gl, repetition);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, wrapS);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, wrapT);
    if (this.minification === 'mipmap') gl.generateMipmap(gl.TEXTURE_2D);
    gl.bindTexture(gl.TEXTURE_2D, null);
```

`WeaselRenderer.ts` — add to `WeaselRendererOptions`:

```ts
  /** MIN_FILTER strategy for image/pattern textures (`GLImageCache`).
   *  Default `'linear'` — the existing screen behavior. The headless
   *  `renderSceneToPixels` path passes `'mipmap'` for print-quality
   *  minification. Explicitly passing `'linear'` is always valid. */
  imageMinification?: ImageMinification;
```

and pass it where `GLImageCache` is constructed (search `new GLImageCache(` in the constructor and in the context-restore path — update BOTH):

```ts
this.imageCache = new GLImageCache(this.gl, opts.imageMinification ?? 'linear');
```

(Store `opts.imageMinification ?? 'linear'` on a private field so the context-restore path reuses it. Import `ImageMinification` type.)

- [ ] **Step 4: Run tests**

Run: `npx vitest run src/renderer/cache/GLImageCache.test.ts src/renderer/WeaselRenderer.test.ts src/renderer/draw.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/renderer/cache/GLImageCache.ts src/renderer/WeaselRenderer.ts src/renderer/cache/GLImageCache.test.ts src/renderer/test-utils/glRecorder.ts
git commit -m "feat(renderer): opt-in mipmap minification for image textures"
```

---

### Task 4: Output-scale tessellation — `flattenTolerance` through `DrawContext`

At print scale, the fixed 0.5-world-unit flatten tolerance produces visible facets (e.g. 2 output px of error at 4 px/unit). The mesh WeakMap is keyed by Path identity only, so a custom tolerance must bypass it — route through the existing transient pool instead.

**Files:**
- Modify: `src/renderer/WeaselRenderer.ts`, `src/renderer/draw.ts`
- Test: `src/renderer/draw.test.ts`

- [ ] **Step 1: Write the failing test**

Append to `src/renderer/draw.test.ts`, following its existing renderer-vs-recorder pattern (crib the file's helper for building a renderer + a polygon path command; the assertion below is the essence):

```ts
describe('flattenTolerance option', () => {
  const curvedPath = (): Path => ({
    kind: 'polygon',
    // one cubic segment — forces bezier flattening
    contours: [/* crib a curved-contour fixture from an existing test in this file */],
  } as unknown as Path);

  it('routes fills through the transient pool when flattenTolerance is set', () => {
    const rec = makeGLRecorder();
    const r = new WeaselRenderer({ gl: rec.gl, width: 100, height: 100, dpr: 1, flattenTolerance: 0.01 });
    r.render([{ kind: 'path', path: curvedPath(), fill: { fill: 'solid', color: '#000' } }]);
    // Transient meshes are freed at end of render(): deleteVertexArray +
    // deleteBuffer calls prove the fill did NOT come from the persistent cache.
    expect(rec.calls.map((c) => c.name)).toContain('deleteVertexArray');
  });

  it('default path (no option) keeps the persistent cache route', () => {
    const rec = makeGLRecorder();
    const r = new WeaselRenderer({ gl: rec.gl, width: 100, height: 100, dpr: 1 });
    r.render([{ kind: 'path', path: curvedPath(), fill: { fill: 'solid', color: '#000' } }]);
    expect(rec.calls.map((c) => c.name)).not.toContain('deleteVertexArray');
  });
});
```

(Adapt the fixture to the file's real `Path` builders — several tests there already construct polygon paths with bezier segments. If solid-rect fast-path interferes, the curved polygon avoids it by construction.)

- [ ] **Step 2: Run to verify failure**

Run: `npx vitest run src/renderer/draw.test.ts`
Expected: FAIL — `flattenTolerance` not an option; no transient route for fills.

- [ ] **Step 3: Implement**

`WeaselRendererOptions` gains:

```ts
  /** Flatness tolerance for curve tessellation, in WORLD units (see
   *  `TessellateOptions.flattenTolerance`). When set, path fills are
   *  tessellated fresh at this tolerance per frame (transient pool) instead
   *  of served from the Path-identity mesh cache — the cache key does not
   *  include tolerance. Default: unset — the existing cached behavior at
   *  `DEFAULT_FLATTEN_TOLERANCE`. The headless path derives this from the
   *  requested output scale; screen callers normally leave it unset. */
  flattenTolerance?: number;
```

Store it on the renderer, add `flattenTolerance?: number` to `DrawContext` (`draw.ts:26-53`), and set it in the `DrawContext` literal inside `render()` (`WeaselRenderer.ts:299-320`).

In `draw.ts`, add `import { tessellate } from 'features/paths/tessellate/tessellate';` and a helper next to `getMesh` usage:

```ts
/** Resolve a fill mesh handle honoring ctx.flattenTolerance: default route is
 *  the persistent Path-identity cache; a custom tolerance tessellates fresh
 *  and rides the transient pool (freed at end of frame), because the
 *  persistent cache's key does not include tolerance. */
function fillMeshHandle(ctx: DrawContext, path: Path): GLMeshHandle {
  if (ctx.flattenTolerance !== undefined) {
    return ctx.meshCache.uploadTransient(tessellate(path, { flattenTolerance: ctx.flattenTolerance }));
  }
  return ctx.meshCache.handleFor(getMesh(path));
}
```

Replace the three `getMesh` call sites (`draw.ts:270`, `:543`, `:721`) with `fillMeshHandle(ctx, ...)`. Check `tessellateStroke`'s signature (`features/paths/tessellate/stroke.ts`): if it accepts `TessellateOptions` (its polyline flattening reads `opts.flattenTolerance`), thread `{ flattenTolerance: ctx.flattenTolerance }` at both call sites (`:669`, `:723`); if it doesn't, add an optional trailing `opts?: TessellateOptions` parameter to it and thread through to its internal `flattenPolyline` call — do not change its default.

- [ ] **Step 4: Run tests**

Run: `npx vitest run src/renderer/draw.test.ts src/renderer/WeaselRenderer.test.ts src/features/paths/tessellate/`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/renderer/draw.ts src/renderer/WeaselRenderer.ts src/renderer/draw.test.ts src/features/paths/tessellate/stroke.ts
git commit -m "feat(renderer): flattenTolerance option — output-scale tessellation via transient pool"
```

---

### Task 5: `WeaselRenderer.dispose()`

Per-call headless renderers on a caller-owned `gl` must not leak programs/buffers. Screen path is untouched (Canvas.tsx keeps its renderer for the component lifetime).

**Files:**
- Modify: `src/renderer/WeaselRenderer.ts`
- Test: `src/renderer/WeaselRenderer.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
describe('dispose', () => {
  it('deletes owned GL programs and shared geometry, removes canvas listeners', () => {
    const rec = makeGLRecorder();
    const r = new WeaselRenderer({ gl: rec.gl, width: 10, height: 10, dpr: 1 });
    r.dispose();
    const names = rec.calls.map((c) => c.name);
    // 5 built-in programs: pathFill, pathFillVColor, textSdf, imageFill, gradFill
    expect(names.filter((n) => n === 'deleteProgram').length).toBeGreaterThanOrEqual(5);
    expect(names).toContain('deleteBuffer');
  });

  it('is idempotent', () => {
    const rec = makeGLRecorder();
    const r = new WeaselRenderer({ gl: rec.gl, width: 10, height: 10, dpr: 1 });
    r.dispose();
    const countAfterFirst = rec.calls.filter((c) => c.name === 'deleteProgram').length;
    r.dispose();
    expect(rec.calls.filter((c) => c.name === 'deleteProgram').length).toBe(countAfterFirst);
  });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `npx vitest run src/renderer/WeaselRenderer.test.ts`
Expected: FAIL — `dispose` is not a function.

- [ ] **Step 3: Implement**

Add to `WeaselRenderer` (after `resize`). First check `ShaderProgram` (`src/renderer/shaders/ShaderProgram.ts`) for an existing delete/dispose method and use it if present; otherwise delete via `gl.deleteProgram(prog.handle)`:

```ts
  private disposed = false;

  /** Free the GL resources this renderer itself owns: compiled programs
   *  (built-ins + registered), the shared quad/rect geometry, and any
   *  transient meshes. Also detaches context-loss listeners when a canvas
   *  was supplied. Idempotent.
   *
   *  Scope: persistent per-content caches (meshes keyed by Path, textures
   *  keyed by bitmap/atlas id) are NOT enumerated here — they are reclaimed
   *  with the GL context itself. Callers that hand a long-lived `gl` to
   *  many short-lived renderers (the headless render-to-pixels path) get
   *  the important part: programs and buffers do not accumulate. */
  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    const gl = this.gl;
    if (this.canvas) {
      this.canvas.removeEventListener('webglcontextlost', this.boundOnLost);
      this.canvas.removeEventListener('webglcontextrestored', this.boundOnRestored);
    }
    this.meshCache.freeTransient();
    this.meshCache.drainPendingDeletes();
    for (const prog of [this.pathFill, this.pathFillVColor, this.textSdf, this.imageFill, this.gradFill]) {
      gl.deleteProgram(prog.handle);
    }
    for (const prog of this.programRegistry.values()) {
      gl.deleteProgram(prog.handle);
    }
    this.programRegistry.clear();
    if (this.quadVbo) gl.deleteBuffer(this.quadVbo);
    if (this.quadIbo) gl.deleteBuffer(this.quadIbo);
    if (this.rectVbo) gl.deleteBuffer(this.rectVbo);
    if (this.rectIbo) gl.deleteBuffer(this.rectIbo);
    if (this.rectVao) gl.deleteVertexArray(this.rectVao);
  }
```

(Verify the field names for the shared geometry against the class — `quadVbo`, `quadIbo`, `rectVao`, `rectVbo`, `rectIbo` all exist per `WeaselRenderer.ts:83-88`. If `ShaderProgram.handle` isn't the raw `WebGLProgram`, use the accessor the class provides.)

- [ ] **Step 4: Run tests**

Run: `npx vitest run src/renderer/WeaselRenderer.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/renderer/WeaselRenderer.ts src/renderer/WeaselRenderer.test.ts
git commit -m "feat(renderer): WeaselRenderer.dispose() frees owned GL programs and geometry"
```

---

### Task 6: `renderSceneToPixels` — the headless entry point

**Files:**
- Create: `src/canvas/renderSceneToPixels.ts`
- Test: `src/canvas/renderSceneToPixels.test.ts`

- [ ] **Step 1: Write the failing tests (pure planning half)**

Create `src/canvas/renderSceneToPixels.test.ts`:

```ts
import { describe, it, expect, vi } from 'vitest';
import { planPixelRender, renderSceneToPixels } from './renderSceneToPixels';
import { makeGLRecorder } from '../renderer/test-utils/glRecorder';
import type { Node, Scene } from 'core/scene/types';

interface RectPose { x: number; y: number; width: number; height: number }

function leaf(id: string, pose: RectPose, data: unknown): Node<unknown, 'default', RectPose> {
  return { id, kind: 'leaf', layer: 'default', parent: null, pose, data } as unknown as Node<unknown, 'default', RectPose>;
}

function fakeScene(nodes: Node<unknown, 'default', RectPose>[]): Scene<unknown, 'default', RectPose> {
  const byId = new Map(nodes.map((n) => [n.id, n]));
  return {
    renderOrder: () => nodes.map((n) => n.id),
    get: (id: string) => byId.get(id),
  } as unknown as Scene<unknown, 'default', RectPose>;
}

const RECT = { x: 5, y: 10, width: 40, height: 20 };

describe('planPixelRender', () => {
  it('rounds output dims from rect × scale, per axis', () => {
    const p = planPixelRender({ scene: fakeScene([]), sourceRect: { x: 0, y: 0, width: 10.4, height: 5.5 }, scale: { x: 1, y: 1 } });
    expect(p.width).toBe(10);   // round(10.4)
    expect(p.height).toBe(6);   // round(5.5)
  });

  it('anisotropic scale lands in the view verbatim', () => {
    const p = planPixelRender({ scene: fakeScene([]), sourceRect: RECT, scale: { x: 3, y: 2 } });
    expect(p.view).toEqual({ x: 5, y: 10, scale: { x: 3, y: 2 } });
    expect(p.width).toBe(120);  // 40 × 3
    expect(p.height).toBe(40);  // 20 × 2
  });

  it('clamps output dims to a 1px minimum', () => {
    const p = planPixelRender({ scene: fakeScene([]), sourceRect: { x: 0, y: 0, width: 0.1, height: 0.1 }, scale: { x: 1, y: 1 } });
    expect(p.width).toBe(1);
    expect(p.height).toBe(1);
  });

  it('transparent by default: first command is the view group, no background fill', () => {
    const p = planPixelRender({ scene: fakeScene([]), sourceRect: RECT, scale: { x: 1, y: 1 } });
    expect(p.commands).toHaveLength(1);
    expect(p.commands[0].kind).toBe('group');
  });

  it('background parameter prepends a screen-space fill covering the output', () => {
    const p = planPixelRender({ scene: fakeScene([]), sourceRect: RECT, scale: { x: 2, y: 2 }, background: '#ffffff' });
    expect(p.commands[0]).toMatchObject({
      kind: 'path',
      path: { kind: 'rect', x: 0, y: 0, width: 80, height: 40 },
      fill: { fill: 'solid', color: '#ffffff' },
    });
    expect(p.commands[1].kind).toBe('group');
  });

  it('resolveImage feeds the default drawOne — bitmap passes straight through (single resample)', () => {
    const bmp = { width: 500, height: 300, close() {} } as unknown as ImageBitmap;
    const scene = fakeScene([leaf('i', { x: 0, y: 0, width: 10, height: 10 }, { image: { src: 'big' } })]);
    const p = planPixelRender({ scene, sourceRect: RECT, scale: { x: 4, y: 4 }, resolveImage: () => bmp });
    const group = p.commands[p.commands.length - 1] as { kind: 'group'; children: Array<{ kind: string; image?: ImageBitmap }> };
    const img = group.children.find((c) => c.kind === 'image');
    // The ORIGINAL bitmap rides the command — no intermediate raster.
    expect(img?.image).toBe(bmp);
  });

  it('source-rect cropping: view origin offsets node coordinates', () => {
    const scene = fakeScene([leaf('r', { x: 5, y: 10, width: 1, height: 1 }, { fill: '#000' })]);
    const p = planPixelRender({ scene, sourceRect: RECT, scale: { x: 1, y: 1 } });
    // Node at the rect origin renders at output (0,0): the group transform is
    // viewToMat3({x:5, y:10, scale:{x:1,y:1}}) — translation = (-5, -10).
    const g = p.commands[0] as { transform: number[] };
    expect(g.transform[6]).toBe(-5);
    expect(g.transform[7]).toBe(-10);
  });

  it('rejects nonpositive or non-finite dimensions', () => {
    expect(() => planPixelRender({ scene: fakeScene([]), sourceRect: { x: 0, y: 0, width: 0, height: 10 }, scale: { x: 1, y: 1 } })).toThrow();
    expect(() => planPixelRender({ scene: fakeScene([]), sourceRect: RECT, scale: { x: -1, y: 1 } })).toThrow();
    expect(() => planPixelRender({ scene: fakeScene([]), sourceRect: RECT, scale: { x: NaN, y: 1 } })).toThrow();
  });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `npx vitest run src/canvas/renderSceneToPixels.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement the module (planning + GL execution)**

Create `src/canvas/renderSceneToPixels.ts`:

```ts
/**
 * `renderSceneToPixels` — headless rasterization of a scene-space rect to
 * raw RGBA pixels at an explicit, per-axis scale.
 *
 * One renderer, two callers: this path drives the same WebGL2 pipeline
 * (`WeaselRenderer` + `buildSceneViewCommands`) as the on-screen view — it is
 * NOT a second renderer. Print, thumbnail, and export callers get the same
 * pixels the screen would produce at that scale.
 *
 * Environment contract:
 * - Density arrives exclusively via `scale` (output pixels per scene unit,
 *   per axis — anisotropic values are first-class). This function never
 *   reads `window.devicePixelRatio`.
 * - Rounding policy: output width = max(1, round(sourceRect.width × scale.x)),
 *   height analogously. The scene-space rect is authoritative; the pixel
 *   grid derives from it.
 * - Context lifetime: a `WeaselRenderer` is constructed per call and
 *   `dispose()`d before returning (per-call shader compilation is the
 *   accepted v1 cost — see docs/TODO.md "raster session" follow-up).
 *   With a caller-supplied `gl`, the context itself is caller-owned: it is
 *   never disposed here, and its drawing buffer must be at least
 *   width × height pixels (the render targets the bottom-left region).
 *   Auto-created canvases (`OffscreenCanvas` when available, else a detached
 *   DOM canvas) are discarded after readback.
 * - Context loss: throws — a lost context cannot produce pixels, and the
 *   silent-noop convention of the screen path would return all-zero bytes.
 * - Output: top-down row order, NON-premultiplied ("straight") RGBA. The GL
 *   framebuffer is premultiplied (blendFunc ONE, ONE_MINUS_SRC_ALPHA) and
 *   bottom-up; readback flips and unpremultiplies. Over an opaque
 *   `background` both transforms are visually moot but still applied.
 * - Determinism: same context + same inputs → same bytes. Cross-driver /
 *   cross-machine byte equality is NOT guaranteed (GL rasterization varies);
 *   do not build golden-image tests on committed bytes.
 * - Image quality: image textures upload with mipmaps
 *   (`imageMinification: 'mipmap'`) so minified bitmaps don't moiré, and
 *   curve tessellation runs at an output-scale tolerance
 *   (`flattenTolerancePx`, default 0.25 output px). A bitmap node's source
 *   pixels are sampled exactly once, directly to the output grid.
 */
import { WeaselRenderer } from '../renderer/WeaselRenderer';
import type { DrawCommand } from '../renderer/DrawCommand';
import type { View } from '../core/viewport/view';
import type { Node, Scene } from '../core/scene/types';
import { buildSceneViewCommands, type SceneViewDrawOne } from './sceneViewRender';
import { defaultDrawOne } from './defaultDrawOne';

/** Plain RGBA raster — structurally `ImageData`-compatible ({ width, height,
 *  data }), deliberately free of printer/dpi/physical-unit concepts. */
export interface RasterImage {
  width: number;
  height: number;
  /** Top-down, straight (non-premultiplied) RGBA, 4 bytes per pixel. */
  data: Uint8ClampedArray;
}

/** Minimal canvas contract for `createCanvas` injection: `OffscreenCanvas`,
 *  an HTML canvas, or a test fake. */
export interface HeadlessCanvasLike {
  width: number;
  height: number;
  getContext(contextId: 'webgl2', options?: WebGLContextAttributes): unknown;
}

export interface RenderSceneToPixelsArgs<TData, TLayer extends string, TPose> {
  scene: Scene<TData, TLayer, TPose>;
  /** Scene-space rect to render (origin + size in scene units). Output pixel
   *  dimensions follow from rect × scale (round, min 1 — see module doc). */
  sourceRect: { x: number; y: number; width: number; height: number };
  /** Output pixels per scene unit, per axis. Anisotropic values supported. */
  scale: { x: number; y: number };
  /** Per-node draw callback. Default: `defaultDrawOne` with `resolveImage`
   *  threaded as its `NodePaintCtx`. Custom `drawOne` callers that still
   *  want resolver injection should call `defaultDrawOne(node, pose, ctx)`
   *  themselves. */
  drawOne?: SceneViewDrawOne<TData, TLayer, TPose>;
  /** Bitmap resolver for image nodes — lets consumers reuse their own decode
   *  caches. `undefined` results paint the deterministic grey placeholder
   *  outline (see `NodePaintCtx.resolveImage`). */
  resolveImage?: (node: Node<TData, TLayer, TPose>) => ImageBitmap | undefined;
  /** Background fill (any CSS color accepted by the renderer). Default:
   *  fully transparent. Passing a color is always valid. */
  background?: string;
  /** Caller-owned WebGL2 context to render with. Mutually exclusive with
   *  `createCanvas`. Never disposed by this call. */
  gl?: WebGL2RenderingContext;
  /** One-shot canvas factory (DOM canvas, OffscreenCanvas, or test fake).
   *  Mutually exclusive with `gl`. Default: `OffscreenCanvas` when
   *  available, else `document.createElement('canvas')`. */
  createCanvas?: (widthPx: number, heightPx: number) => HeadlessCanvasLike;
  /** Max curve-flattening error in OUTPUT pixels. Default 0.25. Converted to
   *  world units against the larger scale axis and passed to the renderer's
   *  `flattenTolerance`. Explicitly passing 0.25 is always valid. */
  flattenTolerancePx?: number;
}

export interface PixelRenderPlan {
  width: number;
  height: number;
  view: View;
  commands: DrawCommand[];
}

/** Pure planning half of `renderSceneToPixels`: output dimensions, the
 *  anisotropic `View`, and the full command list (background + view-wrapped
 *  scene). Exported for tests and for callers targeting their own renderer. */
export function planPixelRender<TData, TLayer extends string, TPose>(
  args: Omit<RenderSceneToPixelsArgs<TData, TLayer, TPose>, 'gl' | 'createCanvas' | 'flattenTolerancePx'>,
): PixelRenderPlan {
  const { sourceRect, scale } = args;
  for (const [label, v] of [
    ['sourceRect.width', sourceRect.width], ['sourceRect.height', sourceRect.height],
    ['scale.x', scale.x], ['scale.y', scale.y],
  ] as const) {
    if (!Number.isFinite(v) || v <= 0) {
      throw new Error(`renderSceneToPixels: ${label} must be a positive finite number, got ${v}`);
    }
  }
  const width = Math.max(1, Math.round(sourceRect.width * scale.x));
  const height = Math.max(1, Math.round(sourceRect.height * scale.y));
  const view: View = { x: sourceRect.x, y: sourceRect.y, scale: { x: scale.x, y: scale.y } };

  const resolveImage = args.resolveImage as ((n: Node<unknown, string, unknown>) => ImageBitmap | undefined) | undefined;
  const drawOne: SceneViewDrawOne<TData, TLayer, TPose> =
    args.drawOne ?? ((node, pose) => defaultDrawOne(node, pose, { resolveImage }));

  const commands: DrawCommand[] = [];
  if (args.background !== undefined) {
    // Screen-space (pre-view) fill so rounding can never leave uncovered
    // edge pixels.
    commands.push({
      kind: 'path',
      path: { kind: 'rect', x: 0, y: 0, width, height },
      fill: { fill: 'solid', color: args.background },
    });
  }
  commands.push(...buildSceneViewCommands(args.scene, view, drawOne));
  return { width, height, view, commands };
}

function defaultCreateCanvas(width: number, height: number): HeadlessCanvasLike {
  if (typeof OffscreenCanvas !== 'undefined') {
    return new OffscreenCanvas(width, height);
  }
  if (typeof document !== 'undefined') {
    const c = document.createElement('canvas');
    c.width = width;
    c.height = height;
    return c;
  }
  throw new Error('renderSceneToPixels: no canvas source in this environment — supply `gl` or `createCanvas`');
}

/** Flip GL's bottom-up readback rows into top-down image order. */
function flipRows(raw: Uint8Array, width: number, height: number): Uint8ClampedArray {
  const rowBytes = width * 4;
  const out = new Uint8ClampedArray(raw.length);
  for (let y = 0; y < height; y++) {
    out.set(raw.subarray((height - 1 - y) * rowBytes, (height - y) * rowBytes), y * rowBytes);
  }
  return out;
}

/** Convert premultiplied RGBA to straight RGBA in place. */
function unpremultiply(data: Uint8ClampedArray): void {
  for (let i = 0; i < data.length; i += 4) {
    const a = data[i + 3];
    if (a === 0 || a === 255) continue;
    const inv = 255 / a;
    data[i] = data[i] * inv;
    data[i + 1] = data[i + 1] * inv;
    data[i + 2] = data[i + 2] * inv;
  }
}

export function renderSceneToPixels<TData, TLayer extends string, TPose>(
  args: RenderSceneToPixelsArgs<TData, TLayer, TPose>,
): RasterImage {
  if (args.gl && args.createCanvas) {
    throw new Error('renderSceneToPixels: `gl` and `createCanvas` are mutually exclusive');
  }
  const plan = planPixelRender(args);
  const { width, height } = plan;

  let gl = args.gl;
  if (!gl) {
    const canvas = (args.createCanvas ?? defaultCreateCanvas)(width, height);
    canvas.width = width;
    canvas.height = height;
    // Same context attributes as the screen path (Canvas.tsx).
    gl = canvas.getContext('webgl2', { preserveDrawingBuffer: true, stencil: true }) as WebGL2RenderingContext | null ?? undefined;
  }
  if (!gl || typeof (gl as Partial<WebGL2RenderingContext>).enable !== 'function') {
    throw new Error('renderSceneToPixels: WebGL2 is unavailable — supply `gl` or a WebGL2-capable `createCanvas`');
  }
  if (typeof gl.isContextLost === 'function' && gl.isContextLost()) {
    throw new Error('renderSceneToPixels: the supplied WebGL2 context is lost');
  }

  const flattenTolerancePx = args.flattenTolerancePx ?? 0.25;
  const renderer = new WeaselRenderer({
    gl,
    width,
    height,
    dpr: 1,
    imageMinification: 'mipmap',
    flattenTolerance: flattenTolerancePx / Math.max(args.scale.x, args.scale.y),
  });
  try {
    renderer.render(plan.commands);
    if (typeof gl.isContextLost === 'function' && gl.isContextLost()) {
      throw new Error('renderSceneToPixels: WebGL2 context was lost during render');
    }
    const raw = new Uint8Array(width * height * 4);
    gl.readPixels(0, 0, width, height, gl.RGBA, gl.UNSIGNED_BYTE, raw);
    const data = flipRows(raw, width, height);
    unpremultiply(data);
    return { width, height, data };
  } finally {
    renderer.dispose();
  }
}
```

- [ ] **Step 4: Run the planning tests**

Run: `npx vitest run src/canvas/renderSceneToPixels.test.ts`
Expected: `planPixelRender` describe PASSES.

- [ ] **Step 5: Write the failing GL-execution tests**

Append to `src/canvas/renderSceneToPixels.test.ts`:

```ts
describe('renderSceneToPixels — GL execution (glRecorder)', () => {
  const recorderFactory = (rec: ReturnType<typeof makeGLRecorder>) =>
    (w: number, h: number) => ({ width: w, height: h, getContext: () => rec.gl });

  it('sizes the viewport to the output grid and reads back the full rect', () => {
    const rec = makeGLRecorder();
    renderSceneToPixels({ scene: fakeScene([]), sourceRect: RECT, scale: { x: 3, y: 2 }, createCanvas: recorderFactory(rec) });
    const viewport = rec.calls.find((c) => c.name === 'viewport');
    expect(viewport?.args).toEqual([0, 0, 120, 40]);
    const read = rec.calls.find((c) => c.name === 'readPixels');
    expect(read?.args.slice(0, 4)).toEqual([0, 0, 120, 40]);
  });

  it('same-context determinism: identical call sequences across runs', () => {
    const run = () => {
      const rec = makeGLRecorder();
      const scene = fakeScene([leaf('r', RECT, { fill: '#123456', label: undefined })]);
      renderSceneToPixels({ scene, sourceRect: RECT, scale: { x: 2, y: 1 }, background: '#ffffff', createCanvas: recorderFactory(rec) });
      return rec.calls.map((c) => c.name).join(',');
    };
    expect(run()).toBe(run());
  });

  it('flips rows: GL bottom-up becomes top-down output', () => {
    const rec = makeGLRecorder();
    // Wrap the recorder gl so readPixels fills each GL row y with byte value y.
    const gl = new Proxy(rec.gl, {
      get(target, prop, receiver) {
        if (prop === 'readPixels') {
          return (_x: number, _y: number, w: number, h: number, _f: number, _t: number, out: Uint8Array) => {
            for (let y = 0; y < h; y++) out.fill(y, y * w * 4, (y + 1) * w * 4);
          };
        }
        return Reflect.get(target, prop, receiver);
      },
    }) as typeof rec.gl;
    const img = renderSceneToPixels({
      scene: fakeScene([]),
      sourceRect: { x: 0, y: 0, width: 2, height: 3 },
      scale: { x: 1, y: 1 },
      createCanvas: (w, h) => ({ width: w, height: h, getContext: () => gl }),
    });
    // GL row 2 (top of image) must land in output row 0.
    expect(img.data[0]).toBe(2);
    expect(img.data[2 * 2 * 4]).toBe(0); // output bottom row = GL row 0
  });

  it('unpremultiplies on readback', () => {
    const rec = makeGLRecorder();
    const gl = new Proxy(rec.gl, {
      get(target, prop, receiver) {
        if (prop === 'readPixels') {
          return (_x: number, _y: number, w: number, h: number, _f: number, _t: number, out: Uint8Array) => {
            // Premultiplied half-transparent red everywhere: (128, 0, 0, 128).
            for (let i = 0; i < w * h * 4; i += 4) { out[i] = 128; out[i + 3] = 128; }
          };
        }
        return Reflect.get(target, prop, receiver);
      },
    }) as typeof rec.gl;
    const img = renderSceneToPixels({
      scene: fakeScene([]),
      sourceRect: { x: 0, y: 0, width: 1, height: 1 },
      scale: { x: 1, y: 1 },
      createCanvas: (w, h) => ({ width: w, height: h, getContext: () => gl }),
    });
    expect(Array.from(img.data)).toEqual([255, 0, 0, 128]);
  });

  it('performs ZERO devicePixelRatio reads (regression guard)', () => {
    let reads = 0;
    const original = Object.getOwnPropertyDescriptor(window, 'devicePixelRatio');
    Object.defineProperty(window, 'devicePixelRatio', {
      configurable: true,
      get() { reads++; return 1; },
    });
    try {
      const rec = makeGLRecorder();
      renderSceneToPixels({ scene: fakeScene([]), sourceRect: RECT, scale: { x: 2, y: 2 }, createCanvas: recorderFactory(rec) });
      expect(reads).toBe(0);
    } finally {
      if (original) Object.defineProperty(window, 'devicePixelRatio', original);
      else delete (window as { devicePixelRatio?: number }).devicePixelRatio;
    }
  });

  it('disposes the per-call renderer', () => {
    const rec = makeGLRecorder();
    renderSceneToPixels({ scene: fakeScene([]), sourceRect: RECT, scale: { x: 1, y: 1 }, createCanvas: recorderFactory(rec) });
    expect(rec.calls.map((c) => c.name)).toContain('deleteProgram');
  });

  it('throws when WebGL2 is unavailable (jsdom default canvas)', () => {
    // vitest.setup.ts stubs getContext('webgl2') to null.
    expect(() =>
      renderSceneToPixels({ scene: fakeScene([]), sourceRect: RECT, scale: { x: 1, y: 1 } }),
    ).toThrow(/WebGL2 is unavailable/);
  });

  it('throws when both gl and createCanvas are supplied', () => {
    const rec = makeGLRecorder();
    expect(() =>
      renderSceneToPixels({
        scene: fakeScene([]), sourceRect: RECT, scale: { x: 1, y: 1 },
        gl: rec.gl, createCanvas: recorderFactory(rec),
      }),
    ).toThrow(/mutually exclusive/);
  });
});
```

(If the recorder's synthetic `isContextLost` returns a truthy object instead of `false`, extend `glRecorder.ts`'s special-cases table so `isContextLost` returns `false` — same mechanism as its `getShaderParameter` handling.)

- [ ] **Step 6: Run all module tests**

Run: `npx vitest run src/canvas/renderSceneToPixels.test.ts`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add src/canvas/renderSceneToPixels.ts src/canvas/renderSceneToPixels.test.ts src/renderer/test-utils/glRecorder.ts
git commit -m "feat(canvas): renderSceneToPixels — headless render-to-pixels at explicit per-axis scale"
```

---

### Task 7: Public exports + typecheck

**Files:**
- Modify: `src/index.ts`

- [ ] **Step 1: Export the new surface**

Next to the sceneViewRender exports (`src/index.ts:304-306`):

```ts
export { renderSceneToPixels, planPixelRender } from './canvas/renderSceneToPixels';
export type {
  RenderSceneToPixelsArgs,
  RasterImage,
  HeadlessCanvasLike,
  PixelRenderPlan,
} from './canvas/renderSceneToPixels';
```

Next to the NodeShape type exports (`src/index.ts:251-253`), add `NodePaintCtx`. In the renderer exports, add `ImageMinification` alongside the other renderer types (find where `WeaselRendererOptions` or renderer types are exported; if `WeaselRendererOptions` isn't exported, export `ImageMinification` from wherever `src/renderer/index.ts` surfaces types).

- [ ] **Step 2: Typecheck and full-ish test pass**

Run: `npx tsc --noEmit && npx vitest run src/canvas src/renderer`
Expected: clean. If typedoc is part of the docs pipeline (`npm run` lists a docs script), run it and fix any "referenced but not exported" warnings by exporting the type — never by suppressing the warning.

- [ ] **Step 3: Commit**

```bash
git add src/index.ts src/renderer/index.ts
git commit -m "feat(exports): renderSceneToPixels + NodePaintCtx/RasterImage public surface"
```

---

### Task 8: Screen-path dPR audit — density as a parameter on `<Canvas>`

Requirement 3: screen and headless share the "density is a parameter" contract; screen behavior must not change. `sceneViewRender.ts` already takes `dpr?` (parametric, ambient fallback). `useCanvasSize.ts` is the designated screen-side density source. That leaves `Canvas.tsx`'s two inline ambient reads.

**Files:**
- Modify: `src/canvas/Canvas.tsx`, `src/core/viewport/useCanvasSize.ts` (comment only)
- Test: create `src/canvas/Canvas.dpr.test.tsx`

- [ ] **Step 1: Write the failing test**

Create `src/canvas/Canvas.dpr.test.tsx` (jsdom setup cribbed from `Canvas.viewport.test.tsx:34-53` — copy the `beforeAll` getContext/pointer-capture stub verbatim):

```tsx
import { describe, it, expect, vi, beforeAll } from 'vitest';
import { render } from '@testing-library/react';
import { Canvas } from './Canvas';

beforeAll(() => {
  const proto = HTMLCanvasElement.prototype as unknown as {
    getContext: (...args: unknown[]) => unknown;
    setPointerCapture: (...args: unknown[]) => void;
    releasePointerCapture: (...args: unknown[]) => void;
  };
  proto.getContext = vi.fn(() => null);
  proto.setPointerCapture = vi.fn();
  proto.releasePointerCapture = vi.fn();
});

function countDprReads(run: () => void): number {
  let reads = 0;
  const original = Object.getOwnPropertyDescriptor(window, 'devicePixelRatio');
  Object.defineProperty(window, 'devicePixelRatio', {
    configurable: true,
    get() { reads++; return 1; },
  });
  try { run(); } finally {
    if (original) Object.defineProperty(window, 'devicePixelRatio', original);
    else delete (window as { devicePixelRatio?: number }).devicePixelRatio;
  }
  return reads;
}

describe('Canvas dpr prop', () => {
  it('with dpr supplied, the paint path performs no ambient devicePixelRatio reads', () => {
    const reads = countDprReads(() => {
      render(<Canvas width={200} height={200} layers={{}} dpr={2} />);
    });
    expect(reads).toBe(0);
  });

  it('without dpr, the ambient fallback still reads window.devicePixelRatio (unchanged screen behavior)', () => {
    const reads = countDprReads(() => {
      render(<Canvas width={200} height={200} layers={{}} />);
    });
    expect(reads).toBeGreaterThan(0);
  });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `npx vitest run src/canvas/Canvas.dpr.test.tsx`
Expected: FAIL — `dpr` not a prop; first test counts ≥1 read.

- [ ] **Step 3: Implement**

In `CanvasProps` (`Canvas.tsx:188`):

```ts
  /** Drawing-buffer density (device pixels per CSS pixel). When omitted the
   *  canvas reads `window.devicePixelRatio` per paint — the long-standing
   *  screen behavior. Supplying it makes density an explicit parameter, the
   *  same contract the headless `renderSceneToPixels` path follows (that
   *  path never reads ambient density at all). */
  dpr?: number;
```

In `CanvasInner`'s destructuring (`Canvas.tsx:675+`), add `dpr: dprProp,`. Replace both ambient reads (`Canvas.tsx:1480` and `:1504`):

```ts
      const dpr = dprProp ?? (window.devicePixelRatio || 1);
```

Add `dprProp` to the paint effect's dependency array (`Canvas.tsx:1521`).

In `useCanvasSize.ts`, extend the hook's doc comment (no behavior change):

```ts
/** Track a container's content-rect size and the current devicePixelRatio via `ResizeObserver`.
 *  This hook is the screen path's designated ambient-density source — rendering code should
 *  take density as a parameter (cf. `renderSceneToPixels`, `renderSceneToCanvas`'s `dpr`)
 *  rather than reading `window.devicePixelRatio` inline. */
```

- [ ] **Step 4: Run tests**

Run: `npx vitest run src/canvas/Canvas.dpr.test.tsx src/canvas/Canvas.test.tsx src/canvas/Canvas.viewport.test.tsx`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/canvas/Canvas.tsx src/canvas/Canvas.dpr.test.tsx src/core/viewport/useCanvasSize.ts
git commit -m "refactor(canvas): dpr as an explicit Canvas prop; ambient read becomes the fallback"
```

---

### Task 9: Demo — `RenderToPixelsDemo`

Earns its keep: it is the same-context real-GL determinism harness for Task 10, and shows the thumbnail/export use in the smallest plausible form.

**Files:**
- Create: `apps/site/demos/RenderToPixelsDemo.tsx`
- Modify: `apps/site/registry.ts`

- [ ] **Step 1: Create the demo**

```tsx
import { useEffect, useRef, useState } from 'react';
import { SceneCanvas, useScene, renderSceneToPixels } from '@weasel-js/core';

const W = 480, H = 240;

interface NodeData { fill?: string; stroke?: string; label?: string }
type LayerId = 'default';
interface Pose { x: number; y: number; width: number; height: number }

export function RenderToPixelsDemo() {
  const scene = useScene<NodeData, LayerId, Pose>({
    systemLayers: [{ id: 'default' }],
    initial: [
      { id: 'a' as never, kind: 'leaf', layer: 'default',
        pose: { x: 40, y: 40, width: 120, height: 160 }, data: { fill: '#7fb069' } },
      { id: 'b' as never, kind: 'leaf', layer: 'default',
        pose: { x: 180, y: 70, width: 120, height: 100 }, data: { fill: '#4a7fb0' } },
      { id: 'c' as never, kind: 'leaf', layer: 'default',
        pose: { x: 330, y: 50, width: 110, height: 140 }, data: { fill: '#d4a574' } },
    ],
  });
  const outRef = useRef<HTMLCanvasElement>(null);
  const [readout, setReadout] = useState('rendering…');

  useEffect(() => {
    // Anisotropic on purpose: 2 px/unit horizontally, 1 px/unit vertically —
    // the label-print shape (full dot pitch across, squeezed vertically).
    const opts = {
      scene,
      sourceRect: { x: 0, y: 0, width: W, height: H },
      scale: { x: 2, y: 1 },
      background: '#ffffff',
    } as const;
    const first = renderSceneToPixels(opts);
    const second = renderSceneToPixels(opts);
    const identical =
      first.data.length === second.data.length &&
      first.data.every((v, i) => v === second.data[i]);

    const out = outRef.current;
    if (out) {
      out.width = first.width;
      out.height = first.height;
      out.getContext('2d')?.putImageData(new ImageData(first.data, first.width, first.height), 0, 0);
    }
    setReadout(`headless ${first.width}×${first.height} px · identical: ${identical ? 'yes' : 'no'}`);
  }, [scene]);

  return (
    <div>
      <SceneCanvas width={W} height={H} className="ckd-canvas" scene={scene} toolBundle="minimal" />
      <p data-testid="rtp-readout">{readout}</p>
      <canvas ref={outRef} className="ckd-canvas" data-testid="rtp-output" />
    </div>
  );
}
```

(If `useScene`'s option names differ from `ImageDemo.tsx`'s, mirror `ImageDemo.tsx` exactly — it is the template. No inline styles.)

- [ ] **Step 2: Register it**

In `apps/site/registry.ts`: add the component import and the `?raw` import alongside the others, then an entry in the `'Rendering & paint'` category block (near line 451):

```ts
  {
    id: 'render-to-pixels',
    title: 'Headless render-to-pixels',
    category: 'Rendering & paint',
    description: 'renderSceneToPixels() rasterizes a scene-space rect to raw RGBA at an explicit per-axis scale — no on-screen canvas, no ambient devicePixelRatio. The snapshot below is rendered at an anisotropic 2×1 px/unit onto a white background and blitted into a 2D canvas; the readout re-renders and byte-compares to demonstrate same-context determinism. This is the print/thumbnail/export primitive: physical units (dpi, mm) stay the caller\'s business.',
    hint: 'The top canvas is the live scene; the bottom image is the headless raster at 2×1 px/unit. The readout confirms two headless renders produced identical bytes.',
    Component: RenderToPixelsDemo,
    full: RenderToPixelsDemoFull,
    path: 'apps/site/demos/RenderToPixelsDemo.tsx',
  },
```

- [ ] **Step 3: Verify in the dev server**

```bash
npm run dev:kit
```

Open `http://localhost:<port>/#render-to-pixels` (launch the server in the background; report the URL). Expected: live scene on top, a 960×240 snapshot below (horizontally stretched 2×), readout says `identical: yes`.

- [ ] **Step 4: Commit**

```bash
git add apps/site/demos/RenderToPixelsDemo.tsx apps/site/registry.ts
git commit -m "docs(demos): render-to-pixels — headless raster + same-context determinism readout"
```

---

### Task 10: Real-GL browser spec (no baseline)

The handoff's `canvas-gl.spec.ts` pointer is stale (file no longer exists); the spec lives with the other Playwright specs in `tests/visual/`, but asserts in-page values only — no committed golden bytes (GL rasterization is not byte-stable across drivers).

**Files:**
- Create: `tests/visual/render-to-pixels.spec.ts`

- [ ] **Step 1: Write the spec**

```ts
/**
 * Real-GL assertions for `renderSceneToPixels` — same-context only.
 * Deliberately NO committed baseline: GL rasterization is not byte-identical
 * across drivers, so this spec asserts in-page invariants (dims, readback
 * orientation via known layout, background color, same-context determinism)
 * instead of golden images.
 */
import { test, expect } from '@playwright/test';

test('render-to-pixels — dims, background, and same-context determinism', async ({ page }) => {
  await page.goto('/#render-to-pixels');
  const readout = page.getByTestId('rtp-readout');
  await expect(readout).toHaveText(/identical: yes/, { timeout: 15_000 });
  await expect(readout).toHaveText(/960×240 px/);

  // Pixel probes on the blitted 2D canvas (top-down proof + background + fill).
  const probe = await page.evaluate(() => {
    const c = document.querySelector<HTMLCanvasElement>('[data-testid="rtp-output"]')!;
    const ctx = c.getContext('2d')!;
    const px = (x: number, y: number) => Array.from(ctx.getImageData(x, y, 1, 1).data);
    return {
      corner: px(2, 2),                 // background (white)
      insideA: px(200, 120),            // node 'a': scene (100,120) → output (200,120), fill #7fb069
    };
  });
  expect(probe.corner).toEqual([255, 255, 255, 255]);
  // Interior of an axis-aligned solid rect — allow ±2/channel for driver variance.
  const [r, g, b, a] = probe.insideA;
  expect(Math.abs(r - 0x7f)).toBeLessThanOrEqual(2);
  expect(Math.abs(g - 0xb0)).toBeLessThanOrEqual(2);
  expect(Math.abs(b - 0x69)).toBeLessThanOrEqual(2);
  expect(a).toBe(255);
});
```

(Verify the probe coordinate against the demo's actual node poses: node `a` spans scene x∈[40,160], y∈[40,200] → output x∈[80,320], y∈[40,200] at 2×1; (200,120) is interior. Check what color the default rect painter fills for `data.fill` — if the fallback painter strokes instead of fills, probe a point known-interior to the FILL, or give the demo nodes whatever data shape the fallback painter fills; adjust demo/probe together.)

- [ ] **Step 2: Run it**

Run: `npx playwright test render-to-pixels --config tests/visual/playwright.config.ts`
Expected: PASS locally (this spec has no baseline, so the pinned-CI-runner rule for baselines does not apply). If Playwright browsers are missing locally, run `npx playwright install chromium` first.

- [ ] **Step 3: Commit**

```bash
git add tests/visual/render-to-pixels.spec.ts
git commit -m "test(visual): real-GL render-to-pixels spec — same-context assertions, no baseline"
```

---

### Task 11: Docs — TODO, handoff status, audit notes

**Files:**
- Modify: `docs/TODO.md`, `docs/handoffs/2026-07-19-headless-render-to-pixels.md`

- [ ] **Step 1: Update `docs/TODO.md`**

- Locate the P3 "Headless server-side rendering" entry (line ~360) and rewrite it to reflect the new state: the browser/worker headless path now exists (`renderSceneToPixels`); the remaining P3 scope is Node — supply a `gl` from `headless-gl` (untested) or run in a worker with `OffscreenCanvas`.
- Locate the P3 "Printable snapshot mode" entry (line ~274) and note that `renderSceneToPixels` is the primitive it should compose with.
- Add new follow-up entries under the renderer section:
  - `(P3) Raster session API — amortize per-call shader compilation when a consumer renders many thumbnails/pages against one context (renderSceneToPixels currently constructs + disposes a WeaselRenderer per call).`
  - `(P3) Screen adoption of mipmap image minification — imageMinification: 'mipmap' exists on WeaselRenderer but the screen path stays 'linear'; evaluate upload-time generateMipmap cost before flipping the default (print already gets it).`
  - `(P3) Gradient ramp resolution at print scale — 1×256 LINEAR ramps verified adequate for 8-bit output (interpolation error < 1/255 per channel); revisit only if >8-bit output ever lands.`

- [ ] **Step 2: Mark the handoff**

Append to `docs/handoffs/2026-07-19-headless-render-to-pixels.md`:

```markdown
## Status — landed 2026-07-19

Implemented on branch `headless-render-to-pixels` as `renderSceneToPixels`
(`src/canvas/renderSceneToPixels.ts`); see the plan at
`docs/superpowers/plans/2026-07-19-headless-render-to-pixels.md`.
Notes against the spec:
- Req 6: mipmap fix applies to `GLImageCache` only — `GLTextureCache` is the
  MSDF atlas cache, where mipmaps are deliberately excluded (they corrupt the
  SDF signal). Tessellation regenerates at output scale via
  `flattenTolerance` through the transient pool (mesh cache key is
  Path-identity only). Gradient ramps (1×256, LINEAR) verified adequate for
  8-bit output.
- Acceptance: `canvas-gl.spec.ts` no longer exists; the real-GL spec is
  `tests/visual/render-to-pixels.spec.ts` (no committed baseline).
- lbx-editor migration remains a follow-up in that repo; `labelRender.ts`
  maps to unit math + one `renderSceneToPixels` call
  (`scale.x = dotsPerPt`, `scale.y = dotsPerPt × printableDots / (tapeWidthPt × dotsPerPt)`,
  `sourceRect = {0, 0, labelLengthPt, tapeWidthPt}`, `background: '#ffffff'`,
  `resolveImage` from its bitmap cache).
```

- [ ] **Step 3: Commit**

```bash
git add docs/TODO.md docs/handoffs/2026-07-19-headless-render-to-pixels.md
git commit -m "docs: TODO + handoff status for headless render-to-pixels"
```

---

### Task 12: Full gate

- [ ] **Step 1: Run the release-parity gate**

```bash
npx tsc --noEmit && npx vitest run && npm run build
```

Expected: all green (this mirrors CI's `prepublishOnly` gate; vitest alone doesn't typecheck production code).

- [ ] **Step 2: Screen-behavior spot-check**

Run: `npx vitest run src/canvas src/renderer packages`
Expected: PASS — no screen rendering test changed behavior. Do not recapture any visual baselines; none should differ (the only screen-path diffs are the `dpr` prop fallback and a pass-through `GLImageCache` default).

- [ ] **Step 3: Final commit if anything moved, then stop**

Do NOT push and do NOT open a PR — both need explicit approval. Offer the merge-back to `main` as the closing message.

---

## Self-review (done at plan time)

- **Spec coverage:** req 1 → Task 6 (`scale: {x, y}`, tests); req 2 → Task 6 (`sourceRect`, rounding policy documented + tested); req 3 → Task 6 guard test + Task 8 audit/seam; req 4 → Task 6 (`gl`/`createCanvas`/default, lifetime + loss documented and tested) + Task 5 (dispose); req 5 → Tasks 1-2 (`NodePaintCtx`, deterministic fallback tested); req 6 → Task 3 (mipmaps, GLImageCache only) + Task 4 (tessellation at output scale) + ramp adequacy note in Task 11; req 7 → Task 6 (background param, transparent default, tests); req 8 → Task 6 (flip + unpremultiply, tested; no dpi anywhere). Acceptance: unit tests per item; real-GL spec Task 10; screen tests Task 12; demo Task 9; TODO Task 11.
- **Known judgment calls for the executor:** exact fixture shapes in `draw.test.ts`/`GLImageCache.test.ts` follow those files' existing patterns (marked inline); demo node-data shape must match what the fallback painter fills (marked in Task 10); `tessellateStroke` opts threading depends on its current signature (both branches specified in Task 4).
