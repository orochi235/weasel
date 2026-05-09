# WebGL Transition — Step 7: Port Built-in Layers

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Port every built-in `RenderLayer` factory to optionally emit a `DrawCommand[]` tree alongside its existing 2D `draw(ctx, …)` method. External factory signatures are preserved; the only `RenderLayer` change is **additive**: a new optional `drawGL?(data, view, dims): DrawCommand[]`. The 2D `draw` keeps working unchanged. The eight ported layers are `createPathLayer`, `createTextLayer`, `createGridLayer`, `createCellHighlightLayer`, `createChildrenLayer`, `createSelectionOverlayLayer` (+ outline/handles variants), `createPenPreviewLayer`, and `createDebugOverlayLayer`. Exits when a sample scene rendered through both backends produces the expected DrawCommand tree shape under unit tests, AND a Playwright smoke spec verifies the GL backend renders non-empty pixels for a multi-layer scene composed of the ported layers.

**Architecture (§A — additive `drawGL`, not replacement):** The cheapest, most-reversible shape for `RenderLayer` is to add an optional method, not change `draw`'s signature:

```ts
export interface RenderLayer<TData> {
  id: string;
  label: string;
  /** Existing 2D path. Stays unchanged through step 9. */
  draw: (ctx: CanvasRenderingContext2D, data: TData, view: View) => void;
  /** GL path. Returns a DrawCommand tree the GL renderer dispatches. */
  drawGL?: (data: TData, view: View, dims: Dims) => DrawCommand[];
  defaultVisible?: boolean;
  alwaysOn?: boolean;
  space?: 'world' | 'screen';
}
```

This buys us four things over a "replace `draw` with `DrawCommand[]` return" reshape: (1) **Rollback**: if step 7's port hits a snag, revert is one PR — `drawGL` is purely additive, no consumer breaks. (2) **Audit clarity**: every layer is reviewable as a side-by-side diff (existing `draw` next to new `drawGL`) instead of a wholesale rewrite where the 2D behavior has to be reverse-engineered from the new tree at review time. (3) **Soak parity**: through step 9's visual-regression soak, both backends run from the same `RenderLayer` object — the dispatch happens in step 8's `<Canvas>` port, not at every layer call site. (4) **No `<Canvas>` change required in step 7**: the 2D dispatcher (`drawLayers` in `src/core/layers/render.ts`) ignores `drawGL`; only the (yet-unwritten) GL dispatcher reads it. Step 7 ships pure additive code; nothing 2D regresses.

The wholesale-replacement alternative (`draw` returns `DrawCommand[]`; the 2D backend interprets them) was rejected because it requires writing a 2D-side `DrawCommand` interpreter just for the soak window, then deleting it — substantial throwaway work. The spec's final shape (after step 10) is `draw: (data, view, dims) => DrawCommand[]`; step 10 deletes the old `draw` and renames `drawGL` → `draw`. Step 7 lands the `drawGL` half.

**Architecture (§B — view, dims, and coordinate spaces):** The 2D `draw(ctx, data, view)` runs after `drawLayers` has applied a `ctx.scale/translate` for world-space layers. The GL renderer doesn't pre-apply that transform; instead, world-space `RenderLayer`s should emit their DrawCommands wrapped in a `kind: 'group'` whose `transform` is the world→screen matrix derived from `view`. Screen-space layers (`space: 'screen'`) emit DrawCommands directly in screen-space CSS pixels (the same coords they currently pass to the ctx). A `viewToMat3(view)` helper in `weasel-gl` (or imported from the main package) provides the world→screen matrix.

`dims: { width: number; height: number }` is the canvas's CSS-pixel size. Some layers (`createDebugOverlayLayer`'s layer-list panel) need it because they anchor to the canvas's right edge. Today's 2D `draw` reads it via `ctx.canvas.width` (which is in device pixels — DPR-multiplied). The GL `drawGL` receives `dims` in CSS pixels; layers that need device pixels can compute via the renderer's DPR (deferred — no current layer needs that).

**Tech stack:** TypeScript (strict), vitest, Playwright. No new npm dependencies.

**Spec:** [`docs/superpowers/specs/2026-05-08-webgl-transition-plan-design.md`](../specs/2026-05-08-webgl-transition-plan-design.md), Sequencing → Step 7. The spec's final `RenderLayer` shape (after step 10) returns `DrawCommand[]` from `draw`; step 7 lands the additive interim form.

## Required reading before starting

- [`webgl-stepwise-conventions.md`](./webgl-stepwise-conventions.md) — accumulated lessons. Entries §1, §2, §6, §8 apply directly (see task callouts below).
- [`2026-05-09-webgl-step-6-done.md`](./2026-05-09-webgl-step-6-done.md) — most recent done note.
- [`2026-05-09-webgl-step-4-done.md`](./2026-05-09-webgl-step-4-done.md) — gradient `Paint` types are public on `@orochi235/weasel`; layers can pass them through.
- `src/core/layers/render.ts` — current `RenderLayer` + `drawLayers`; only file the interface change touches.
- `packages/weasel-gl/src/DrawCommand.ts` — every variant the layers can emit.
- `packages/weasel-gl/src/index.ts` — barrel; layers import `DrawCommand` from `@orochi235/weasel-gl`.
- The eight layer source files listed in the File structure section.

**Conventions cited by specific tasks below:**

- Task 1 (`RenderLayer` interface change): one cluster commit. The interface change + the eight layer ports + the `Dims` type all touch the same shape; merge per the step-4 lesson "when shapes interlock, merge tasks." Subtasks may still review independently, but typecheck must remain green between commits — practically this means tasks 1–10 land in one commit (or two: interface + path/text/grid/etc.).
- Task 3 (`createPathLayer`): conventions §1 — 2D ctx mocks won't catch GL coordinate-space mistakes. Snapshot the tree shape under a unit test, verify pixel output via the smoke task (Task 12).
- Task 4 (`createTextLayer`): MSDF text needs `registerFont(family, atlasUrl)` to be called before `drawGL` produces useful output. Document this in the JSDoc and have the smoke test register the default font before render.
- Task 11 (smoke spec): conventions §6 — `preserveDrawingBuffer: true` + `stencil: true` on the dev page's `getContext`; conventions §1 update — 16×16 grid sampling, not diagonal.

**Deferred — out of scope for step 7:**

| Item | Why deferred | Future home |
|---|---|---|
| `<Canvas>` / `<SceneCanvas>` reading `drawGL` and dispatching to `WeaselRenderer` | Step 8 owns the component port. Step 7 ships layers + interface only. | Step 8 |
| Visual regression rig (per-demo baselines, ≤ 2% pixel diff) | Step 9 already has a written plan. | Step 9 |
| Removing the 2D `draw` from `RenderLayer` and renaming `drawGL` → `draw` | Final step swap. | Step 10 |
| Per-vertex colors on stroke ribbons | Step 5 deferral; no current layer needs it. | Future spec |
| FBO-based effects (drop shadow, blur, masks) | Step 4 deferral. None of the eight layers use them today. | v2 |
| Pen preview's curve-handle drag visualization rendering as a `kind: 'shader'` effect | The current 2D code is plain strokes + dots; no shader effect needed in port. | — |
| `globalCompositeOperation` / Porter-Duff blending | None of the eight layers use it; if a custom layer needs it, it's a v2 concern. | v2 |
| `setLineDash` translation for `createDebugOverlayLayer`'s hitbox dashes | Stroke `dash` is supported via `Stroke.dash` (step 2). The debug layer currently uses `ctx.setLineDash([2,2])`; port emits `Stroke { dash: [2, 2] }`. In scope, not deferred. | — |

---

## File structure

Files this plan creates or modifies:

```
src/
  core/layers/
    render.ts                          MODIFY — add drawGL?(data, view, dims) optional method;
                                                add Dims type; extend drawLayers to ignore drawGL;
                                                no behavior change for 2D path.
    render.test.ts                     MODIFY — assert drawGL is ignored by drawLayers;
                                                assert RenderLayer<T>.drawGL is optional.
  features/paths/
    pathLayer.ts                       MODIFY — add drawGL.
    pathLayer.test.ts                  MODIFY — assert returned DrawCommand tree shape for sample input.
    penPreviewLayer.ts                 MODIFY — add drawGL (screen-space dots, lines, rubber-band curves).
    penPreviewLayer.test.ts            MODIFY (or NEW if absent) — tree-shape assertions.
  features/text/
    textLayer.ts                       MODIFY — add drawGL emitting TextDrawCommand per line.
    textLayer.test.ts                  MODIFY — tree-shape assertions.
  features/grid/
    layer.ts                           MODIFY — add drawGL emitting Path commands per grid line band.
    layer.test.ts                      MODIFY (or NEW if absent) — tree-shape assertions.
    cellHighlight.ts                   MODIFY — add drawGL emitting one filled rect path.
    cellHighlight.test.ts              MODIFY (or NEW) — tree-shape assertions.
  features/groups/
    children.ts                        MODIFY — add drawGL; document that drawChild's GL counterpart
                                                lands in step 8 (consumer-supplied callback;
                                                createChildrenLayer is a pass-through aggregator).
    children.test.ts                   MODIFY — tree-shape assertions.
  features/selection/
    overlay.ts                         MODIFY — add drawGL to all three factories
                                                (outline, handles, overlay convenience wrapper).
    overlay.test.ts                    MODIFY — tree-shape assertions.
  debug/
    createDebugOverlayLayer.ts         MODIFY — add drawGL.
    createDebugOverlayLayer.test.ts    MODIFY (or NEW) — tree-shape assertions.

packages/weasel-gl/
  src/
    viewToMat3.ts                      NEW — viewToMat3(view: View) → Mat3 helper used by
                                              world-space drawGL implementations.
    viewToMat3.test.ts                 NEW
    index.ts                           MODIFY — export viewToMat3.

  dev/
    layers.html                        NEW — smoke page composing ported layers.
    layers.ts                          NEW — sample scene: grid + cell highlight + path + text +
                                              selection overlay; renders via WeaselRenderer.
    layers.spec.ts                     NEW — Playwright smoke spec.

docs/superpowers/plans/
  2026-05-09-webgl-step-7-done.md      NEW (written at step end).
```

---

## RenderLayer interface change (reference for Task 1)

```ts
// src/core/layers/render.ts (after the change)

import type { View } from '../../features/viewport/view';
import type { DrawCommand } from '@orochi235/weasel-gl';

const IDENTITY_VIEW: View = { x: 0, y: 0, scale: 1 };

/** Canvas size in CSS pixels — passed to drawGL for layers that anchor to canvas edges. */
export interface Dims {
  width: number;
  height: number;
}

/**
 * A single named render sub-layer within a canvas renderer.
 *
 * @template TData - The data object passed to each draw call.
 */
export interface RenderLayer<TData> {
  /** Unique identifier used in visibility maps and ordering arrays. */
  id: string;
  /** Human-readable name for UI toggles. */
  label: string;
  /**
   * Draw this layer's content onto a 2D canvas context. The 2D backend.
   * Stays unchanged through step 9; deleted in step 10 when drawGL → draw.
   */
  draw: (ctx: CanvasRenderingContext2D, data: TData, view: View) => void;
  /**
   * Emit a DrawCommand tree for the GL backend to dispatch. Optional through
   * step 9 — layers may ship `drawGL` incrementally. Step 10 makes this the
   * sole `draw` and removes the 2D one.
   *
   * For world-space layers (the default), the GL backend dispatches the tree
   * under no extra transform — wrap world-space content in a kind:'group'
   * with `transform: viewToMat3(view)` so it maps to screen coords. For
   * screen-space layers (`space: 'screen'`), emit commands in screen-space
   * CSS pixels directly, matching the 2D behavior.
   */
  drawGL?: (data: TData, view: View, dims: Dims) => DrawCommand[];
  defaultVisible?: boolean;
  alwaysOn?: boolean;
  space?: 'world' | 'screen';
}

// drawLayers() unchanged. Add a TS-level note: the 2D dispatcher ignores
// drawGL entirely. The GL dispatcher (lands in step 8) reads drawGL.
export function drawLayers<TData>(/* …unchanged signature… */): void {
  // …unchanged body…
}
```

---

## Task 1: Add `drawGL` and `Dims` to `RenderLayer`; update `drawLayers` to ignore it

**Files:** `src/core/layers/render.ts`, `src/core/layers/render.test.ts`

**Convention §6 callout:** This is the cluster-commit anchor. Tasks 1–10 (interface + eight layer ports) all share this shape; lump them into a single commit unless an individual layer port grows large enough to warrant its own — in which case tasks 1–2 (interface + simplest layer to validate the shape) commit first, then the rest follow. Decide at execution time based on diff size.

- [ ] **Step 1.** Write a unit test asserting `drawGL` is optional and `drawLayers` ignores it:
  ```ts
  it('drawLayers does not call drawGL', () => {
    const ctx = make2DCtxMock();
    const drawGL = vi.fn(() => []);
    const draw = vi.fn();
    const layer: RenderLayer<unknown> = { id: 'x', label: 'X', draw, drawGL };
    drawLayers(ctx, [layer], {}, {});
    expect(draw).toHaveBeenCalledOnce();
    expect(drawGL).not.toHaveBeenCalled();
  });
  ```
- [ ] **Step 2.** Run the test (expect: TS error, `drawGL` not on `RenderLayer`).
- [ ] **Step 3.** Add `Dims` and `drawGL?: (data, view, dims) => DrawCommand[]` to `RenderLayer` per the reference block above. Add the JSDoc comment. Add the `import type { DrawCommand } from '@orochi235/weasel-gl';` line.
- [ ] **Step 4.** Run the test — passes.
- [ ] **Step 5.** Run `pnpm typecheck` — must be clean. The import from `@orochi235/weasel-gl` may trip a circular-dependency or tsconfig path issue; if so, declare a local minimal `DrawCommand` type alias here using `import type` so it's erased at runtime, but prefer the real import.

> **Self-review:** Does this task break any existing `RenderLayer` consumer? Search `RenderLayer<` across `src/`. Every site declares only the existing fields; the new optional method is purely additive. Confirmed safe.

---

## Task 2: Add `viewToMat3` helper in `weasel-gl`

**Files:** `packages/weasel-gl/src/viewToMat3.ts`, `packages/weasel-gl/src/viewToMat3.test.ts`, `packages/weasel-gl/src/index.ts`

The world-space `drawGL` implementations all need to wrap their content in a `kind: 'group'` with the world→screen transform. Current `weasel-gl` exports `mat3` but no `View`-keyed helper. The transformation is: `screen = (world − {x,y}) × scale` → matrix form `[scale, 0, -view.x*scale, 0, scale, -view.y*scale, 0, 0, 1]` (column-major).

- [ ] **Step 1.** Write a unit test:
  ```ts
  import { viewToMat3 } from './viewToMat3';

  it('identity view → identity mat3', () => {
    expect(viewToMat3({ x: 0, y: 0, scale: 1 }))
      .toEqual(new Float32Array([1, 0, 0, 0, 1, 0, 0, 0, 1]));
  });

  it('view {x:10, y:20, scale:2} → translate(-20,-40) then scale(2)', () => {
    // world (10, 20) → screen (0, 0); world (0, 0) → screen (-20, -40)
    const m = viewToMat3({ x: 10, y: 20, scale: 2 });
    // column-major: [2,0,0, 0,2,0, -20,-40,1]
    expect(Array.from(m)).toEqual([2, 0, 0, 0, 2, 0, -20, -40, 1]);
  });
  ```
- [ ] **Step 2.** Run the test (red — file does not exist).
- [ ] **Step 3.** Implement:
  ```ts
  // packages/weasel-gl/src/viewToMat3.ts
  import type { Mat3 } from './mat3';

  /** A weasel View — {x, y, scale}. Local type to avoid a runtime cross-package import. */
  export interface View { x: number; y: number; scale: number; }

  /**
   * Build the world→screen transform matrix for a `View`.
   * Use as the `transform` field of a kind:'group' DrawCommand to wrap
   * world-space content from a `drawGL` implementation.
   *
   * Mapping: screen = (world - {view.x, view.y}) * view.scale
   */
  export function viewToMat3(view: View): Mat3 {
    const s = view.scale;
    return new Float32Array([
      s, 0, 0,
      0, s, 0,
      -view.x * s, -view.y * s, 1,
    ]) as Mat3;
  }
  ```
- [ ] **Step 4.** Run the test — passes.
- [ ] **Step 5.** Add `export { viewToMat3, type View as ViewLike } from './viewToMat3';` to `packages/weasel-gl/src/index.ts`. (`ViewLike` rename avoids colliding with consumer code that imports `View` from the main package.)
- [ ] **Step 6.** Run `pnpm typecheck` — clean.

> **Plan-time fixture sanity check (convention §3 from step 4):** for view `{x:10, y:20, scale:2}`, world point (10, 20) → ((10-10)*2, (20-20)*2) = (0, 0). World (0, 0) → ((0-10)*2, (0-20)*2) = (-20, -40). Matches the expected matrix's translation column. Verified.

---

## Task 3: Port `createPathLayer`

**What this layer does today:** Iterates a node enumerator, looks up each node's `Path` + `Paint` + `Stroke`, calls `traceToContext` then `ctx.fill()`/`ctx.stroke()`. World-space (default).

**What the GL tree should look like:** One `kind: 'group'` wrapping the world→screen transform, with one `kind: 'path'` child per visible node.

```ts
// drawGL output sketch for createPathLayer
{
  kind: 'group',
  transform: viewToMat3(view),
  children: [
    { kind: 'path', path: <node 0 path>, fill: <node 0 paint>, stroke: <node 0 stroke> },
    { kind: 'path', path: <node 1 path>, fill: <node 1 paint>, stroke: <node 1 stroke> },
    // …
  ],
}
```

**Files:** `src/features/paths/pathLayer.ts`, `src/features/paths/pathLayer.test.ts`

- [ ] **Step 1.** Write a unit test asserting tree shape:
  ```ts
  it('drawGL emits one path command per visible node, wrapped in a world-transform group', () => {
    const path: Path = { kind: 'rect', x: 0, y: 0, width: 10, height: 10 };
    const fill: Paint = { fill: 'solid', color: '#fff' };
    const layer = createPathLayer({
      getNodes: () => [{ id: 'a' }, { id: 'b' }],
      getPath: () => path,
      getFill: () => fill,
    });
    const tree = layer.drawGL!(null, { x: 0, y: 0, scale: 1 }, { width: 100, height: 100 });
    expect(tree).toHaveLength(1);
    expect(tree[0]).toMatchObject({
      kind: 'group',
      children: [
        { kind: 'path', path, fill },
        { kind: 'path', path, fill },
      ],
    });
  });

  it('drawGL skips hidden nodes', () => {
    const path: Path = { kind: 'rect', x: 0, y: 0, width: 10, height: 10 };
    const layer = createPathLayer({
      getNodes: () => [{ id: 'a' }, { id: 'b' }],
      getPath: () => path,
      getFill: () => ({ fill: 'solid', color: '#f00' }),
      isHidden: (n) => n.id === 'b',
    });
    const tree = layer.drawGL!(null, { x: 0, y: 0, scale: 1 }, { width: 100, height: 100 });
    const group = tree[0] as GroupDrawCommand;
    expect(group.children).toHaveLength(1);
  });

  it('drawGL skips nodes with no fill and no stroke', () => {
    // …expect children.length === 0 for that node.
  });
  ```
- [ ] **Step 2.** Run the tests (red).
- [ ] **Step 3.** Add `drawGL` to the returned object:
  ```ts
  drawGL: (_data, view) => {
    const children: DrawCommand[] = [];
    for (const node of getNodes()) {
      if (isHidden?.(node)) continue;
      const path = getPath(node);
      const fill = getFill?.(node);
      const stroke = getStroke?.(node);
      if (fill == null && stroke == null) continue;
      children.push({
        kind: 'path',
        path,
        ...(fill != null ? { fill } : {}),
        ...(stroke != null ? { stroke } : {}),
      });
    }
    return [{ kind: 'group', transform: viewToMat3(view), children }];
  },
  ```
  Add the `import { viewToMat3 } from '@orochi235/weasel-gl';` and `import type { DrawCommand } from '@orochi235/weasel-gl';` at the top.
- [ ] **Step 4.** Run the tests — passes. Run `pnpm typecheck`.

---

## Task 4: Port `createTextLayer`

**What this layer does today:** Iterates text nodes, resolves each pose's `TextStyle`, calls `measureText` to wrap into lines, emits `ctx.fillText` per line. World-space (default).

**What the GL tree should look like:** One world-transform group wrapping one `kind: 'text'` per line per visible node.

```ts
// drawGL output sketch
{
  kind: 'group',
  transform: viewToMat3(view),
  children: [
    { kind: 'text', x: anchorX, y: poseY,            text: 'line 0', style },
    { kind: 'text', x: anchorX, y: poseY + lineH,    text: 'line 1', style },
    // …
  ],
}
```

**MSDF font registration note:** `TextDrawCommand` requires the font's family to be registered via `registerFont(family, atlasUrl)` (step 3). The smoke task (Task 11) registers the kit's default font before render. Layer-level documentation: add a JSDoc note on `createTextLayer` saying GL backend requires the resolved style's font family to be registered.

**Open issue: text width measurement.** The 2D path uses `measureText(ctx, …)` to wrap. The GL backend has no `ctx`. For step 7, **defer real GL-side measurement**: pass `pose.text` as a single line to one `kind: 'text'` command per node. Wrapping via the 2D `measureText` is preserved; we keep the call path but use a stub `ctx` to obtain widths. Concretely:
1. Use `OffscreenCanvas(1, 1).getContext('2d')` if available; fall back to a module-level shared `<canvas>` context.
2. The shared context only needs `.measureText(text)` semantics; `font` is set from `fontString(style)` before the call. This is identical to the 2D path's behavior, just with a stub ctx.

This isolates the GL port from text layout — measurement is an implementation detail. A proper SDF-driven width measurement is a step-8+ optimization.

**Files:** `src/features/text/textLayer.ts`, `src/features/text/textLayer.test.ts`

- [ ] **Step 1.** Add a module-level `getMeasureCtx()` helper that lazy-creates an `OffscreenCanvas` 2D context (or falls back to `document.createElement('canvas').getContext('2d')` in a DOM env).
- [ ] **Step 2.** Write tests asserting tree shape:
  ```ts
  it('drawGL emits one text command per line, anchored by style.align', () => {
    const layer = createTextLayer({
      getTexts: () => [{ id: 'n' }],
      getPose: () => ({ x: 100, y: 200, width: 300, height: 50, text: 'hello' }),
    });
    const tree = layer.drawGL!(null, { x: 0, y: 0, scale: 1 }, { width: 800, height: 600 });
    expect(tree).toHaveLength(1);
    const group = tree[0] as GroupDrawCommand;
    expect(group.children).toHaveLength(1);
    expect(group.children[0]).toMatchObject({ kind: 'text', text: 'hello' });
  });

  it('drawGL respects isHidden', () => {
    // …
  });
  ```
- [ ] **Step 3.** Run the tests (red).
- [ ] **Step 4.** Implement `drawGL`:
  ```ts
  drawGL: (_data, view) => {
    const children: DrawCommand[] = [];
    const measureCtx = getMeasureCtx();
    for (const node of getTexts()) {
      if (isHidden?.(node)) continue;
      const pose = getPose(node);
      const style = resolveTextStyle(pose.style);
      measureCtx.font = fontString(style);
      const { lines } = measureText(measureCtx, pose.text, pose.width, style);
      const lineHeightPx = style.fontSize * style.lineHeight;
      const xAnchor = anchorX(pose.x, pose.width, style);
      for (let i = 0; i < lines.length; i++) {
        children.push({
          kind: 'text',
          x: xAnchor,
          y: pose.y + i * lineHeightPx,
          text: lines[i],
          style: pose.style ?? {},
        });
      }
    }
    return [{ kind: 'group', transform: viewToMat3(view), children }];
  },
  ```
- [ ] **Step 5.** Run the tests — passes. Add a JSDoc note on `createTextLayer`: "GL backend requires the resolved style's `fontFamily` to be registered via `registerFont` from `@orochi235/weasel-gl`. Unregistered families render with a warning and a fallback glyph."

---

## Task 5: Port `createGridLayer`

**What this layer does today:** World-space draw of vertical + horizontal lines at `spacing` intervals, optional finer subdivisions, optional accent lines every `accentEvery`. Each band uses a different `Stroke`. Stroke widths are divided by `view.scale` so they stay 1px-screen on zoom.

**What the GL tree should look like:** A world-transform group containing one `kind: 'path'` per line band (sub, line, accent — three at most, in z-order). Each path is a `polygon` (or polyline-as-rect-segments) with `stroke.width` already divided by `view.scale`. Or, simpler: emit each grid line as its own `kind: 'path'` (polygon-as-line). At step 7 scale (~hundreds of lines), don't optimize.

**Concrete tree sketch:**
```ts
{
  kind: 'group',
  transform: viewToMat3(view),
  children: [
    // sub-lines
    { kind: 'path', path: <polygon: {kind:'line', x0,y0,x1,y1}>, stroke: <subStroke with width/scale> },
    // …
    // cell lines
    { kind: 'path', path: …, stroke: lineStroke },
    // …
    // accents on top
    { kind: 'path', path: …, stroke: accentStroke },
  ],
}
```

> **Path kind for hairlines:** the existing `weasel-gl` stroke ribbon expects a `Path` with at least two points. Use whatever `Path` representation the codebase uses for a single-segment line. Check `src/features/paths/types.ts` — typically `{ kind: 'polygon', points: [{x:x0,y:y0},{x:x1,y:y1}], closed: false }`. The implementer adapts based on actual `Path` types.

**Files:** `src/features/grid/layer.ts`, `src/features/grid/layer.test.ts`

- [ ] **Step 1.** Write a tree-shape test for a simple grid:
  ```ts
  it('drawGL emits vertical + horizontal line paths per band', () => {
    const layer = createGridLayer({
      spacing: 10,
      bounds: () => ({ x: 0, y: 0, width: 30, height: 30 }),
    });
    const tree = layer.drawGL!(null, { x: 0, y: 0, scale: 1 }, { width: 100, height: 100 });
    const group = tree[0] as GroupDrawCommand;
    // For 30×30 / 10 spacing: 4 vlines + 4 hlines = 8 line paths (no accent / sub).
    expect(group.children.filter(c => c.kind === 'path')).toHaveLength(8);
  });

  it('drawGL divides stroke width by view.scale so hairlines are 1px-screen', () => {
    // …assert (group.children[0] as PathDrawCommand).stroke.width === 1 / 2 for scale=2
  });
  ```
- [ ] **Step 2.** Run (red).
- [ ] **Step 3.** Implement `drawGL`. The structure mirrors the 2D `draw` body but pushes to a `children` array instead of mutating ctx:
  ```ts
  drawGL: (_data, view) => {
    const children: DrawCommand[] = [];
    const b = opts.bounds();
    if (b.width <= 0 || b.height <= 0) return [];
    const { accentEvery, subdivisions } = opts;
    const spacing = resolveUnit(opts.spacing, opts.unitSystem);
    const x0 = b.x, y0 = b.y;
    const x1 = b.x + b.width, y1 = b.y + b.height;
    const px = 1 / Math.max(0.0001, view.scale);

    const pushLine = (x0: number, y0: number, x1: number, y1: number, stroke: Stroke) => {
      children.push({
        kind: 'path',
        path: { kind: 'polygon', points: [{ x: x0, y: y0 }, { x: x1, y: y1 }], closed: false },
        stroke: { ...stroke, width: (stroke.width ?? 1) * px },
      });
    };

    // Sub, then cell (skip accents), then accents — same z-order as 2D.
    if (subdivisions && subdivisions > 1) { /* …emit sub vlines + hlines… */ }
    /* cell lines (skip accents) */
    /* accent lines */

    return [{ kind: 'group', transform: viewToMat3(view), children }];
  },
  ```
- [ ] **Step 4.** Run tests — passes.

---

## Task 6: Port `createCellHighlightLayer`

**What this layer does today:** Fills one rect (`x, y, spacing, spacing`) with `fill` paint. World-space.

**What the GL tree should look like:** A world-transform group containing one `kind: 'path'` with a rect path + the fill paint.

```ts
{
  kind: 'group',
  transform: viewToMat3(view),
  children: [
    { kind: 'path', path: { kind: 'rect', x, y, width: spacing, height: spacing }, fill },
  ],
}
```

**Files:** `src/features/grid/cellHighlight.ts`, `src/features/grid/cellHighlight.test.ts`

- [ ] **Step 1.** Test:
  ```ts
  it('drawGL emits one rect path command at the cell coords', () => {
    const layer = createCellHighlightLayer({
      spacing: 20,
      getCell: () => ({ col: 2, row: 3 }),
    });
    const tree = layer.drawGL!(null, { x: 0, y: 0, scale: 1 }, { width: 200, height: 200 });
    const group = tree[0] as GroupDrawCommand;
    expect(group.children[0]).toMatchObject({
      kind: 'path',
      path: { kind: 'rect', x: 40, y: 60, width: 20, height: 20 },
    });
  });

  it('drawGL returns [] when getCell is null', () => {
    const layer = createCellHighlightLayer({ spacing: 20, getCell: () => null });
    expect(layer.drawGL!(null, { x: 0, y: 0, scale: 1 }, { width: 100, height: 100 })).toEqual([]);
  });
  ```
- [ ] **Step 2.** Run (red).
- [ ] **Step 3.** Implement `drawGL` per the sketch.
- [ ] **Step 4.** Run tests — passes.

---

## Task 7: Port `createChildrenLayer`

**What this layer does today:** Iterates an `OrderedAdapter`'s `getChildren(parentId)` in z-order and calls `drawChild(ctx, id, data)` for each. The layer is a thin aggregator; it does not draw anything itself.

**What the GL tree should look like:** This is the awkward one. `drawChild` is consumer-supplied with a 2D-ctx signature; we cannot translate it. The clean port introduces an optional `drawChildGL?(id, data, view): DrawCommand[]` consumer callback. If `drawChildGL` is provided, the layer aggregates its outputs; if not, the layer's `drawGL` returns `[]` with a one-time warning.

> **Step-7 scope decision:** This layer is half-deferred. Land the `drawChildGL` plumbing now so consumers can opt in incrementally; keep returning `[]` (silently or with a dev-only warning) when only `drawChild` exists. Step 8's `<Canvas>` port will refuse to render layers whose `drawGL` returns `[]` only because `drawChildGL` was missing — but that's an integration concern, not a step-7 break.

**Files:** `src/features/groups/children.ts`, `src/features/groups/children.test.ts`

- [ ] **Step 1.** Add `drawChildGL?: (id: string, data: TData, view: View) => DrawCommand[]` to `CreateChildrenLayerOpts`.
- [ ] **Step 2.** Test:
  ```ts
  it('drawGL aggregates drawChildGL outputs across children in z-order', () => {
    const layer = createChildrenLayer({
      adapter: { getChildren: () => ['a', 'b'] },
      drawChild: () => {},
      drawChildGL: (id) => [{ kind: 'path', path: { kind: 'rect', x: 0, y: 0, width: 1, height: 1 }, fill: { fill: 'solid', color: id === 'a' ? '#f00' : '#0f0' } }],
    });
    const tree = layer.drawGL!(null, { x: 0, y: 0, scale: 1 }, { width: 100, height: 100 });
    expect(tree).toHaveLength(2);
    expect((tree[0] as PathDrawCommand).fill).toMatchObject({ color: '#f00' });
    expect((tree[1] as PathDrawCommand).fill).toMatchObject({ color: '#0f0' });
  });

  it('drawGL returns [] when drawChildGL is not provided', () => {
    const layer = createChildrenLayer({
      adapter: { getChildren: () => ['a'] },
      drawChild: () => {},
    });
    expect(layer.drawGL!(null, { x: 0, y: 0, scale: 1 }, { width: 100, height: 100 })).toEqual([]);
  });
  ```
- [ ] **Step 3.** Run (red).
- [ ] **Step 4.** Implement:
  ```ts
  drawGL: (data, view) => {
    if (!opts.drawChildGL) return [];
    const getChildren = opts.adapter.getChildren;
    if (!getChildren) return [];
    const parent = typeof opts.parentId === 'function' ? opts.parentId() : opts.parentId ?? null;
    const ids = getChildren(parent);
    const out: DrawCommand[] = [];
    for (const id of ids) {
      const sub = opts.drawChildGL(id, data, view);
      out.push(...sub);
    }
    return out;
  },
  ```
- [ ] **Step 5.** Run tests — passes.

---

## Task 8: Port `createSelectionOverlayLayer` (and outline / handles variants)

**What this layer does today:** Three factories. `createSelectionOutlineLayer` strokes the AABB of each selected id (group ids reduce to union AABB). `createSelectionHandlesLayer` fills + strokes corner handle squares + optional rotation chevron. `createSelectionOverlayLayer` is the convenience wrapper that runs both. All three are screen-space (`space: 'screen'`) — they project world AABBs to screen coords internally.

**What the GL tree should look like:** Screen-space, so **no world-transform group** needed. Each factory's `drawGL` returns a flat `DrawCommand[]` of `kind: 'path'` commands in screen-space coords.

```ts
// outline
[
  { kind: 'path', path: { kind: 'rect', x, y, width, height }, stroke: alignedStrokeRect-derived },
  // …per selected id
]

// handles (per selected id, per corner)
[
  { kind: 'path', path: <handle rect>, fill: handleFill, stroke: handleOutline },
  // …
  // optional rotation chevron — emit as a polygon path with the chevron's two-segment polyline
]

// overlay (convenience): outline commands ++ handles commands, in that z-order
```

**Rotation chevron note:** the 2D code uses `ctx.lineCap = 'round'` + `lineJoin = 'round'` plus a 2-segment `bezierCurveTo`-free polyline. The GL stroke (step 2) supports `cap: 'round'` + `join: 'round'`. Translate directly: emit the 2-segment chevron as a polygon-as-polyline path with `stroke: { ..., cap: 'round', join: 'round' }`.

**Rotation transform:** rotated AABBs apply a `rotate(rotation)` around the AABB center. In the GL tree, wrap the rotated outline/handle commands in a `kind: 'group'` with a `transform: rotateAround(cx, cy, rotation)` matrix. The implementer constructs the matrix using `mat3` helpers (`mat3.translate(cx, cy) * mat3.rotate(rot) * mat3.translate(-cx, -cy)`).

**Files:** `src/features/selection/overlay.ts`, `src/features/selection/overlay.test.ts`

- [ ] **Step 1.** Write a tree-shape test for the simplest case: one rect-pose selection, no group adapter, no rotation:
  ```ts
  it('drawGL of outline layer emits one stroke path per selected id', () => {
    const layer = createSelectionOutlineLayer({
      getSelection: () => ['a'],
      getPose: () => ({ x: 10, y: 20, width: 30, height: 40 }),
    });
    const tree = layer.drawGL!(null, { x: 0, y: 0, scale: 1 }, { width: 200, height: 200 });
    expect(tree).toHaveLength(1);
    expect(tree[0]).toMatchObject({ kind: 'path' });
  });

  it('drawGL of overlay convenience layer emits outlines then handles in order', () => {
    // …assert children: [outline, handle, handle, handle, handle]
  });

  it('drawGL handles rotated bounds by wrapping in a rotation group', () => {
    // pose has rotation: Math.PI/4 → expect a kind:'group' wrapper
  });
  ```
- [ ] **Step 2.** Run (red).
- [ ] **Step 3.** Implement `drawGL` on each of the three factories. Helper: factor out `outlineCommandsFor(ids, ...)` and `handleCommandsFor(ids, ...)` that return `DrawCommand[]`; each factory's `drawGL` calls one or both.
- [ ] **Step 4.** Run tests — passes.

> **Self-review on rotation handle:** the chevron in 2D draws under `ctx.translate(h.cx, h.cy); ctx.rotate(rotation)`. Translate to a `kind:'group'` with `transform: mat3.translate(h.cx, h.cy) * mat3.rotate(rotation)` wrapping the chevron path. The chevron path coords stay in the local frame (origin at handle center).

---

## Task 9: Port `createPenPreviewLayer`

**What this layer does today:** Screen-space (`space: 'screen'`). Reads the pen tool's persistent scratch each frame; draws (1) finished subpaths as faded strokes, (2) current subpath as a bright stroke, (3) rubber-band segment from latest anchor to cursor (line or single-segment cubic), (4) anchor dots + handle dots/lines for current subpath, (5) close-hint ring on first anchor when hot.

**What the GL tree should look like:** A flat `DrawCommand[]` in screen-space — no transform group needed.

```ts
[
  // (1) finished subpaths
  { kind: 'path', path: <subpath polygon w/ bezier segments>, stroke: { paint:{fill:'solid', color:'#8a7a5e'}, width: 1 } },
  // (2) current subpath
  { kind: 'path', path: <current subpath>, stroke: { ..., color:'#d4c4a8' } },
  // (3) rubber-band
  { kind: 'path', path: <line or cubic>, stroke: { ... } },
  // (4) anchors + handles, per anchor:
  //     anchor dot (filled + stroked circle as a polygon path)
  { kind: 'path', path: <approximated circle>, fill: anchorFill, stroke: anchorStroke },
  //     handle line + handle dot (latest anchor only)
  // (5) close-hint ring
  { kind: 'path', path: <approximated circle>, stroke: { ..., width: 1.5 } },
]
```

**Circle approximation:** the GL `Path` types do not have a primitive `arc` (the kit's existing `Path` is `rect`, `polygon`, or beziered subpaths). Approximate `arc(cx, cy, r, 0, 2π)` as an N-segment polygon (N=24 gives ≤0.5px deviation at r=8). Add a small helper `approximateCircle(cx, cy, r, segments=24): Path` either inside `penPreviewLayer.ts` or as an exported util on `@orochi235/weasel-gl` if useful elsewhere. **Step-7 scope:** keep it inline.

**Bezier subpath translation:** the 2D code uses `ctx.bezierCurveTo`. The kit's `Path` types support cubic segments — re-emit each anchor pair as a cubic `bezier` segment. Use the existing `Path` representation; `traceToContext` reads it the same way `bezierCurveTo` does.

**Files:** `src/features/paths/penPreviewLayer.ts`, `src/features/paths/penPreviewLayer.test.ts`

- [ ] **Step 1.** Write tree-shape tests for a simple scratch state:
  ```ts
  it('drawGL emits paths for current subpath + cursor rubber-band when scratch has anchors and a cursor', () => {
    const scratch: PenScratch = {
      finishedSubpaths: [],
      current: { anchors: [{ x: 0, y: 0 }, { x: 100, y: 100 }], closed: false },
      cursor: { x: 200, y: 200 },
      closeHintActive: false,
      draggingHandleAt: null,
    };
    const tool = { initScratch: () => scratch } as unknown as Tool<PenScratch>;
    const layer = createPenPreviewLayer({ penTool: tool });
    const tree = layer.drawGL!(null, { x: 0, y: 0, scale: 1 }, { width: 400, height: 400 });
    // current subpath + rubber-band + 2 anchor dots = 4 path commands
    expect(tree.length).toBeGreaterThanOrEqual(4);
  });

  it('drawGL emits close-hint ring when scratch.closeHintActive', () => {
    // …expect one extra path command
  });
  ```
- [ ] **Step 2.** Run (red).
- [ ] **Step 3.** Implement `drawGL` mirroring the 2D body, replacing each `ctx.beginPath/moveTo/lineTo/.../stroke()` block with a `Path` value pushed into a `children` array. Replace `ctx.arc` with `approximateCircle`.
- [ ] **Step 4.** Run tests — passes.

> **Convention §8 callout:** geometry shape correctness here can't be confirmed by tree-shape tests alone. The smoke task (Task 11) renders a pen preview scene and confirms anchor dots + rubber band are visible.

---

## Task 10: Port `createDebugOverlayLayer`

**What this layer does today:** Screen-space. Reads the debug sink's snapshot, paints (depending on `config` flags): hitboxes (filled + dashed-stroke rects/circles), bounds (stroked rects), handles (cross marks), origins (filled dots), snap candidates (filled or stroked rings), layer panel (text list with bg rect, anchored to canvas right edge). `alwaysOn: true`.

**What the GL tree should look like:** A flat screen-space `DrawCommand[]`. The layer panel needs `dims.width` for right-edge anchoring.

```ts
[
  // hitboxes
  { kind: 'path', path: <rect or circle approx>, fill: { ..., color: hitboxFillColor }, stroke: { dash: [2,2], ... } },
  // bounds
  { kind: 'path', path: <rect>, stroke: { ... } },
  // handles (cross marks, two-segment polyline each)
  { kind: 'path', path: <horizontal segment>, stroke: { ... } },
  { kind: 'path', path: <vertical segment>,   stroke: { ... } },
  // origins (filled circle approx)
  { kind: 'path', path: <circle approx>, fill: { ... } },
  // snap (filled ring if accepted, stroked otherwise)
  { kind: 'path', path: <circle approx>, fill or stroke: { ... } },
  // layer panel
  { kind: 'path', path: <bg rect>, fill: { ..., color: layerTextBg } },
  { kind: 'text', x, y, text: '[0] grid (world)',  style: { fontFamily: 'ui-monospace', fontSize: 11, ... } },
  // …per layer entry
]
```

**Snapshot world coords project via `view`:** the 2D code projects each snapshot point with `worldToScreen`. The GL `drawGL` does the same — emits screen-space coords directly. The layer is `space: 'screen'` so no world group wraps it.

**Layer panel `dims.width` use:** anchor x = `dims.width - boxW - 8`. Today's 2D path reads `ctx.canvas?.width` (device pixels) which is "near enough" because the panel is right-edge anchored and DPR makes the offset tiny in CSS-pixel space. The GL port reads `dims.width` (CSS pixels) for correctness.

**Path-kind hitboxes:** the 2D code has a `// 'path' kind painted as-is. v1 punt.` comment — preserve the punt; GL port also skips path-kind hitboxes.

**`setLineDash([2, 2])` translation:** emit hitbox stroke with `dash: [2, 2]` (Stroke's `dash` field, supported via step-2 ribbon-mesh dash patterns).

**Files:** `src/debug/createDebugOverlayLayer.ts`, `src/debug/createDebugOverlayLayer.test.ts`

- [ ] **Step 1.** Write a tree-shape test:
  ```ts
  it('drawGL emits commands for each enabled debug section', () => {
    const sink = {
      snapshot: () => ({
        hitboxes: [{ shape: { kind: 'rect', x: 0, y: 0, width: 10, height: 10 } }],
        bounds: [], handles: [], origins: [], snap: [], layers: [],
      }),
    };
    const layer = createDebugOverlayLayer({ sink, config: { hitboxes: true } });
    const tree = layer.drawGL!(null, { x: 0, y: 0, scale: 1 }, { width: 800, height: 600 });
    expect(tree.filter(c => c.kind === 'path')).toHaveLength(1);
  });

  it('drawGL anchors layer panel to canvas right edge using dims.width', () => {
    const sink = { snapshot: () => ({ hitboxes: [], bounds: [], handles: [], origins: [], snap: [], layers: [{ index: 0, id: 'g', space: 'world' }] }) };
    const layer = createDebugOverlayLayer({ sink, config: { layers: true } });
    const tree = layer.drawGL!(null, { x: 0, y: 0, scale: 1 }, { width: 1000, height: 600 });
    const bg = tree.find(c => c.kind === 'path') as PathDrawCommand;
    // Panel at right edge — bg rect.x close to dims.width - boxW - 8.
    expect((bg.path as { x: number }).x).toBeGreaterThan(800);
  });
  ```
- [ ] **Step 2.** Run (red).
- [ ] **Step 3.** Implement `drawGL` mirroring the 2D body section-by-section. Reuse `approximateCircle` from Task 9 (move it into `src/features/paths/approximateCircle.ts` if shared). Project world coords via the same `viewToTransform` + `worldToScreen` calls the 2D path uses.
- [ ] **Step 4.** Run tests — passes.

---

## Task 11: Smoke spec — multi-layer GL scene

**Files:** `packages/weasel-gl/dev/layers.html`, `packages/weasel-gl/dev/layers.ts`, `packages/weasel-gl/dev/layers.spec.ts`

**Convention §6 callout:** dev page's `getContext('webgl2', { preserveDrawingBuffer: true, stencil: true })`.
**Convention §1 update callout:** 16×16 grid pixel sampling, not diagonal.
**MSDF font note:** call `await registerFont('default', '/packages/weasel-gl/fonts/default.json')` before `WeaselRenderer.render()`. The smoke spec must `await` the font load before taking pixel samples.

**Sample scene (world space):**
- Grid layer: spacing 50, bounds (0,0,400,400), accent every 4.
- Cell highlight: cell (2, 2) at spacing 50.
- Path layer: one red rect at (100, 100, 80, 80).
- Text layer: "step seven" at (50, 50, 200, 30).
- Selection overlay: select the rect; outline + 4 corner handles.

The dev page composes the DrawCommand trees from each layer's `drawGL`, concatenates them, and calls `renderer.render(allCommands)`. The Playwright spec asserts non-empty pixels in cells where each layer draws.

- [ ] **Step 1.** Write `dev/layers.html` mirroring `dev/shader.html`'s structure (canvas + script tag + `preserveDrawingBuffer: true`).
- [ ] **Step 2.** Write `dev/layers.ts` constructing the eight ported layers, calling each one's `drawGL`, concatenating, and rendering. Use a hard-coded view `{ x: 0, y: 0, scale: 1 }` and `dims: { width: 512, height: 512 }`.
- [ ] **Step 3.** Write `dev/layers.spec.ts` with three assertions:
  - **Center pixel of red rect (~140, 140) is reddish.** `expect(pixel[0]).toBeGreaterThan(200); expect(pixel[1]).toBeLessThan(50);`
  - **Grid sample point (~25, 25) on a sub-line is non-transparent.**
  - **Outside-everything pixel (~480, 480) is transparent.**
  - 16×16 grid scan: at least 30 sample points have non-zero alpha.
- [ ] **Step 4.** Add `dev/layers.html` to the per-page Vite config (`packages/weasel-gl/dev/vite.config.ts`).
- [ ] **Step 5.** Run `pnpm --filter @orochi235/weasel-gl run test:smoke -- layers.spec.ts`. Iterate until green.

> **Plan-time fixture sanity check (convention §3):** at view `{x:0,y:0,scale:1}` with `viewToMat3`, the world rect at (100,100,80,80) maps directly to screen rect (100,100,80,80). Center is (140, 140). Confirmed.

---

## Task 12: Done note

**Files:** `docs/superpowers/plans/2026-05-09-webgl-step-7-done.md`

- [ ] **Step 1.** Mirror the structure of `2026-05-09-webgl-step-6-done.md`: What shipped / Notable deviations / Test results / Lessons / Open follow-ups.
- [ ] **Step 2.** Update `webgl-stepwise-conventions.md` with any new lessons surfaced during the port. Likely candidates (mark as "filed in step 7" if confirmed):
  - The `dims` plumbing pattern (CSS pixels into `drawGL`) and how it compares to the 2D `ctx.canvas.width` (device pixels) read.
  - Tree-shape tests vs ctx-mock tests — which catches what.
- [ ] **Step 3.** Update the roadmap (`docs/superpowers/plans/2026-05-08-webgl-transition-roadmap.md`) — change step 7 row from "Pending step 6" to **Shipped 2026-05-09**, link to the done note.

---

## Cross-task invariants (verify before commit)

- [ ] Every ported layer's external factory signature is unchanged. `git diff src/features/.../*.ts` shows no signature change to any `createXLayer(opts: …): RenderLayer<…>` declaration; only added `drawGL` and (for `createChildrenLayer`) an optional new `drawChildGL` opt.
- [ ] The 2D `draw` body is **not modified** in any layer. `drawGL` is added alongside; existing tests pass unchanged.
- [ ] `drawLayers` (the 2D dispatcher) does not call `drawGL`. Verify with the test from Task 1.
- [ ] `pnpm test` is green: existing 2D tests + new tree-shape tests.
- [ ] `pnpm typecheck` is clean.
- [ ] The smoke spec (`layers.spec.ts`) is green in headless Chromium.
- [ ] No new npm dependencies. (Confirm with `git diff package.json`.)
- [ ] No changes outside `src/core/layers/render.ts`, the eight layer files, their tests, `packages/weasel-gl/src/viewToMat3.ts`, `packages/weasel-gl/src/index.ts`, and the `packages/weasel-gl/dev/layers.*` smoke files.

---

## Done note template

```md
# WebGL Step 7 — Done

**Plan:** [`2026-05-09-webgl-step-7-port-built-in-layers.md`](./2026-05-09-webgl-step-7-port-built-in-layers.md)
**Date completed:** 2026-05-09

## What shipped

- `RenderLayer<TData>` gained an optional `drawGL?(data, view, dims): DrawCommand[]` method and a new `Dims` type. The 2D `draw` is unchanged; `drawLayers` ignores `drawGL`. Step 8 will dispatch it.
- `viewToMat3(view)` helper exported from `@orochi235/weasel-gl`; world-space layers wrap their `drawGL` output in a `kind:'group'` with this transform.
- Eight built-in layers ported (additive `drawGL`):
  - `createPathLayer` — emits one path command per visible node.
  - `createTextLayer` — emits one text command per wrapped line; uses an offscreen 2D ctx for `measureText` width measurement.
  - `createGridLayer` — emits sub/cell/accent line bands; stroke widths divided by `view.scale`.
  - `createCellHighlightLayer` — emits one rect path command.
  - `createChildrenLayer` — aggregates new optional `drawChildGL` callback in z-order; returns `[]` when not provided.
  - `createSelectionOverlayLayer` (+ outline / handles variants) — emits screen-space outline + handle paths; rotation chevron preserved.
  - `createPenPreviewLayer` — emits subpaths, anchors (circle approximations), handles, rubber-band, close-hint ring.
  - `createDebugOverlayLayer` — emits hitbox/bounds/handle/origin/snap/layer-panel commands; uses `dims.width` for right-edge layer panel.
- `dev/layers.html` + `dev/layers.ts` smoke scene composing five of the ported layers.
- Playwright `dev/layers.spec.ts`: red-rect center pixel, grid line sample, outside-bounds transparency, 16×16 grid alpha scan.

## Notable deviations from plan

- (Fill in during execution.)

## Test results

- Vitest: N/N pass (existing 2D tests + new tree-shape tests).
- Playwright: N/N specs pass (existing + `layers.spec.ts`).
- Typecheck: clean.
- Browser-verified: layers smoke scene renders all five layers correctly.

## Lessons for step 8+ (folded into conventions)

- (Fill in.)

## Open follow-ups

- `<Canvas>` / `<SceneCanvas>` reading `drawGL` and dispatching to `WeaselRenderer` — step 8.
- `createChildrenLayer.drawChildGL` is opt-in; consumers using `drawChild` only will see empty GL output until they add a GL-side renderer per child.
- SDF-driven text width measurement (replacing the offscreen 2D ctx) — perf optimization, lands when needed.
- `circle` Path primitive (currently approximated as polygon in pen preview / debug overlay) — minor API addition if useful elsewhere.
- Rotation handle chevron in `createSelectionOverlayLayer`: emitted as a 2-segment stroked polyline; if visual fidelity is a problem under stroke joins, switch to two separate single-segment paths.
```
