# Tool Primitive — Phase 2c: Zoom + Chrome Screen-Space — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add `view.scale` to the viewport, ship explicit zoom + wheel-pan built-in tools, flip kit chrome to screen space so handles/marquee stay screen-px constant under non-1 scale, change `RenderLayer.draw` and `drawOne` signatures to expose `view`, switch `handleHitRadius` to screen-px semantics, and physically remove `usePan`.

**Architecture:** `View` becomes `{x, y, scale}` (default `{0, 0, 1}`). A pure `zoomAt(view, anchor, factor, opts?)` primitive is shared by every zoom code path. Three new tools register opt-in: `useWheelZoomTool` (alwaysOn, claims wheel when `e.ctrlKey === true`), `useKeyboardZoomTool` (alwaysOn, `Cmd+=`/`Cmd+-`/`Cmd+0`), `useWheelPanTool` (alwaysOn, claims wheel when `e.ctrlKey === false`). `runLayers` wraps `'world'` layers with `setTransform(scale, 0, 0, scale, -view.x*scale, -view.y*scale)` instead of plain translate. `'screen'` layers receive identity transform plus the `view` arg and use `worldToScreen` to pin chrome to screen coords. Selection-overlay/handles/area-select/insert overlays flip to `space: 'screen'`. `handleHitRadius` is divided by `view.scale` at every hit-test site. `usePan` is deleted from source and barrel.

**Tech Stack:** TypeScript, React 18, vitest, jsdom, @testing-library/react. Test runner: `npm test`. Spec: `docs/specs/2026-05-03-tool-primitive-phase-2c-design.md`. Builds on Phase 2b infra: `View`, `viewToTransform`, `RenderLayer.space`, `useHandTool`, hybrid uncontrolled/controlled `view`/`defaultView`/`onViewChange` on `<Canvas>`.

---

## File Structure

| File | Status | Purpose |
| --- | --- | --- |
| `src/features/viewport/view.ts` | MODIFY | Add `scale: number` to `View`. Update `viewToTransform` to `{panX: -view.x*scale, panY: -view.y*scale, zoom: scale}`. Update JSDoc formula. |
| `src/features/viewport/view.test.ts` | MODIFY | Add scale-aware adapter cases; round-trip with non-1 scale. |
| `src/features/viewport/zoomAt.ts` | NEW | Pure `zoomAt(view, anchor, factor, opts?)` with clamping. |
| `src/features/viewport/zoomAt.test.ts` | NEW | Anchor invariance, clamp at min/max, identity at factor=1, default min/max. |
| `src/core/layers/render.ts` | MODIFY | `RenderLayer.draw` signature now `(ctx, data, view) => void`; `view` is required (no longer optional in the runtime). World-space wrap switches from `translate` to `setTransform(scale, 0, 0, scale, -view.x*scale, -view.y*scale)`. |
| `src/core/layers/render.test.ts` | MODIFY | Update existing tests for new signature; cover scale ≠ 1 transform; cover screen-space layer receives identity. |
| `src/canvas/Canvas.tsx` | MODIFY | (a) Default `internalView` to `{x:0,y:0,scale:1}`. (b) Update default `clientToWorld` to `(clientX-rect.left)/scale + view.x`. (c) Pass `effectiveView` to every `drawOne`/`buildInsertOverlayLayer`/`buildAreaSelectOverlayLayer` etc. (d) Mark insert/area-select/selection overlay layers as `space: 'screen'` and convert their world coords via `worldToScreen`. (e) Divide `handleHitRadius` by `effectiveView.scale` where it hits the dispatcher (or pass scale to consumers via ctx). |
| `src/canvas/Canvas.test.tsx` | MODIFY | Update for new draw signature; add scale=2 cases for clientToWorld and chrome rendering. |
| `src/canvas/SceneCanvas.tsx` | MODIFY | If signatures pass through, only check it forwards the new `view` arg correctly. |
| `src/canvas/sceneAdapter.ts` | MODIFY | If `drawOne`-shaped, update signature. |
| `src/canvas/layers.ts` | MODIFY | Update `DefaultLayersScene.drawOne` signature; threaded through scene + ghost layers. |
| `src/features/selection/overlay.ts` | MODIFY | Selection-outline / handles / overlay layers gain `space: 'screen'`. Their draw functions take `view`, project world bounds via `worldToScreen` before issuing `strokeRect`/`fillRect`. Handle size stays in screen px. |
| `src/features/selection/overlay.test.ts` | MODIFY | Cover scale=2 case: handles still rendered at the configured screen size; outline rect maps from world to screen. |
| `src/interactions/usePointerGestures.ts` | MODIFY | `handleHitRadius` (default 8) is interpreted as **screen** px; convert to world by dividing by current `view.scale` at compare time. Needs access to `view` — either threaded through a new param or via a `getView` callback. |
| `src/interactions/usePointerGestures.test.ts` | MODIFY | Add scale=2 hit case showing the screen-px radius matches. |
| `src/tools/builtin/useSelectTool.ts` | MODIFY | Same `handleHitRadius` semantics flip; divide by `ctx.view.scale` at hit-test. |
| `src/tools/builtin/useSelectTool.test.ts` | MODIFY | Cover scale ≠ 1 hit case. |
| `src/tools/builtin/useWheelZoomTool.ts` | NEW | Tool record: alwaysOn, claims wheel when `e.ctrlKey === true`. Uses `zoomAt` with cursor anchor. Calls `e.preventDefault()` on claim. Accepts `{ min, max, wheelStep }`. |
| `src/tools/builtin/useWheelZoomTool.test.ts` | NEW | Claim only when ctrlKey true; anchor invariance via mocked ctx; preventDefault called; clamp respected. |
| `src/tools/builtin/useKeyboardZoomTool.ts` | NEW | Tool record: alwaysOn, keybindings `Cmd+=`, `Cmd+-`, `Cmd+0`. Center anchor (canvas size from ctx or via callback). Accepts `{ min, max, keyStep, getCanvasSize }`. |
| `src/tools/builtin/useKeyboardZoomTool.test.ts` | NEW | Each keybinding produces expected view; reset returns identity. |
| `src/tools/builtin/useWheelPanTool.ts` | NEW | Tool record: alwaysOn, claims wheel when `e.ctrlKey === false`. Translates `view` by `(deltaX/scale, deltaY/scale)`. Calls `e.preventDefault()` on claim. |
| `src/tools/builtin/useWheelPanTool.test.ts` | NEW | Pan delta math under scale=1 and scale=2; ctrlKey=true is passed through to wheel-zoom. |
| `src/tools/builtin/index.ts` | MODIFY | Re-export the three new tools. |
| `src/tools/builtin/integration.test.tsx` | MODIFY | Wire wheel-zoom + wheel-pan + keyboard-zoom + hand into one Canvas; assert composition: ctrl+wheel zooms, plain wheel pans, Cmd+0 resets, hand still drag-pans. |
| `src/features/viewport/usePan.ts` | DELETE | Physical removal. |
| `src/features/viewport/usePan.test.ts` | DELETE | If exists, removed alongside. |
| `src/index.ts` | MODIFY | Drop the `usePan` re-export; add re-exports for `zoomAt`, `useWheelZoomTool`, `useKeyboardZoomTool`, `useWheelPanTool`. |
| `demo/demos/ZoomDemo.tsx` | NEW | Demo wiring all three tools + hand on a small scene. Shows two objects with contrasting stroke policies (one uses `lineWidth = 2 / view.scale`, the other plain `lineWidth = 2`). |
| `demo/registry.ts` | MODIFY | Register `ZoomDemo`. |
| `CHANGELOG.md` | MODIFY | Note breaking changes: `View` shape, `RenderLayer.draw` signature, `drawOne` signature, `handleHitRadius` semantics, `usePan` removal. |

---

## Task 1: Extend `View` with `scale`

**Files:**
- Modify: `src/features/viewport/view.ts`
- Modify: `src/features/viewport/view.test.ts`

The whole pipeline downstream depends on `View.scale` existing. Default value is 1 so existing callers continue to work after they pass through `defaultView`/`Canvas` defaulting.

- [ ] **Step 1: Update `View` and `viewToTransform`**

```ts
// src/features/viewport/view.ts
import type { ViewTransform } from './viewTransform';

/**
 * Viewport state. `view = {x, y}` is the **world point currently rendered at
 * the canvas top-left**; `view.scale` is pixels per world unit.
 *
 *   screenX = (worldX - view.x) * view.scale
 *   worldX  = screenX / view.scale + view.x
 */
export interface View {
  x: number;
  y: number;
  scale: number;
}

export function viewToTransform(view: View): ViewTransform {
  const s = view.scale;
  return { panX: -view.x * s || 0, panY: -view.y * s || 0, zoom: s };
}
```

- [ ] **Step 2: Update view tests**

Add cases:
```ts
it('scales translation under non-1 scale', () => {
  expect(viewToTransform({ x: 10, y: 20, scale: 2 })).toEqual({ panX: -20, panY: -40, zoom: 2 });
});

it('round-trips at scale=2', () => {
  const view: View = { x: 5, y: 5, scale: 2 };
  const t = viewToTransform(view);
  // World (5,5) (the camera origin) renders at screen (0,0)
  expect(worldToScreen(view.x, view.y, t)).toEqual([0, 0]);
  // World (15,5) is +10 world right of origin → screen +20 px
  expect(worldToScreen(15, 5, t)).toEqual([20, 0]);
});
```

Update existing tests to spread `scale: 1` into every `View` literal. Run `npm test -- src/features/viewport/view.test.ts` and confirm green.

- [ ] **Step 3: Commit**

```bash
git add src/features/viewport/view.ts src/features/viewport/view.test.ts
git commit -m "feat(viewport): add scale to View and viewToTransform"
```

---

## Task 2: `zoomAt` primitive

**Files:**
- Create: `src/features/viewport/zoomAt.ts`
- Test: `src/features/viewport/zoomAt.test.ts`

Pure function. No React, no Canvas. Used by both wheel zoom and keyboard zoom.

- [ ] **Step 1: Write the failing test**

```ts
import { describe, it, expect } from 'vitest';
import { zoomAt } from './zoomAt';

describe('zoomAt', () => {
  it('keeps the world point under the anchor invariant', () => {
    const view = { x: 10, y: 10, scale: 1 };
    const anchor = { x: 100, y: 50 }; // screen coords
    // World point under anchor: (100/1 + 10, 50/1 + 10) = (110, 60)
    const next = zoomAt(view, anchor, 2);
    expect(next.scale).toBe(2);
    // Same anchor must still resolve to (110, 60)
    expect(anchor.x / next.scale + next.x).toBeCloseTo(110);
    expect(anchor.y / next.scale + next.y).toBeCloseTo(60);
  });

  it('clamps to default min (0.1) and max (8)', () => {
    expect(zoomAt({ x: 0, y: 0, scale: 1 }, { x: 0, y: 0 }, 0.001).scale).toBe(0.1);
    expect(zoomAt({ x: 0, y: 0, scale: 1 }, { x: 0, y: 0 }, 100).scale).toBe(8);
  });

  it('respects custom min/max', () => {
    expect(
      zoomAt({ x: 0, y: 0, scale: 1 }, { x: 0, y: 0 }, 100, { min: 0.5, max: 2 }).scale,
    ).toBe(2);
  });

  it('factor=1 is identity (modulo float)', () => {
    const view = { x: 7, y: 3, scale: 1.5 };
    const next = zoomAt(view, { x: 50, y: 50 }, 1);
    expect(next.scale).toBeCloseTo(1.5);
    expect(next.x).toBeCloseTo(7);
    expect(next.y).toBeCloseTo(3);
  });
});
```

- [ ] **Step 2: Implement**

```ts
// src/features/viewport/zoomAt.ts
import type { View } from './view';

export interface ZoomClampOpts { min?: number; max?: number }

export function zoomAt(
  view: View,
  anchor: { x: number; y: number },
  factor: number,
  opts?: ZoomClampOpts,
): View {
  const min = opts?.min ?? 0.1;
  const max = opts?.max ?? 8;
  const nextScale = Math.min(max, Math.max(min, view.scale * factor));
  const worldX = anchor.x / view.scale + view.x;
  const worldY = anchor.y / view.scale + view.y;
  return {
    scale: nextScale,
    x: worldX - anchor.x / nextScale,
    y: worldY - anchor.y / nextScale,
  };
}
```

- [ ] **Step 3: Run + commit**

```bash
npm test -- src/features/viewport/zoomAt.test.ts
git add src/features/viewport/zoomAt.ts src/features/viewport/zoomAt.test.ts
git commit -m "feat(viewport): add zoomAt primitive"
```

---

## Task 3: Update `RenderLayer.draw` signature + `runLayers` for scale

**Files:**
- Modify: `src/core/layers/render.ts`
- Modify: `src/core/layers/render.test.ts`

Breaking change. `draw` now takes `(ctx, data, view)`. `view` is non-optional in the *signature* (but `runLayers` keeps `view?: View` for legacy callers and supplies an identity view when omitted). World-space wrap uses `setTransform` with scale.

- [ ] **Step 1: Update render.ts**

```ts
const IDENTITY_VIEW: View = { x: 0, y: 0, scale: 1 };

export interface RenderLayer<TData> {
  id: string;
  label: string;
  draw: (ctx: CanvasRenderingContext2D, data: TData, view: View) => void;
  defaultVisible?: boolean;
  alwaysOn?: boolean;
  space?: 'world' | 'screen';
}

export function runLayers<TData>(
  ctx: CanvasRenderingContext2D,
  layers: RenderLayer<TData>[],
  data: TData,
  visibility: Record<string, boolean>,
  order?: string[],
  view?: View,
): void {
  // …layerById/sequence unchanged…
  const v = view ?? IDENTITY_VIEW;
  for (const layer of sequence) {
    // …visibility check unchanged…
    ctx.save();
    if ((layer.space ?? 'world') === 'world') {
      ctx.setTransform(v.scale, 0, 0, v.scale, -v.x * v.scale, -v.y * v.scale);
    } else {
      ctx.setTransform(1, 0, 0, 1, 0, 0);
    }
    layer.draw(ctx, data, v);
    ctx.restore();
  }
}
```

- [ ] **Step 2: Update render.test.ts**

For each existing test, add a third arg to draw assertions and add `setTransform` call assertions. Add new cases:

```ts
it('uses setTransform with scale for world-space layers', () => {
  const ctx = makeCtxStub();
  const layer: RenderLayer<null> = {
    id: 'a', label: 'a',
    draw: vi.fn(),
  };
  runLayers(ctx, [layer], null, {}, undefined, { x: 5, y: 10, scale: 2 });
  expect(ctx.setTransform).toHaveBeenCalledWith(2, 0, 0, 2, -10, -20);
  expect(layer.draw).toHaveBeenCalledWith(ctx, null, { x: 5, y: 10, scale: 2 });
});

it('uses identity setTransform for screen-space layers', () => {
  const ctx = makeCtxStub();
  const layer: RenderLayer<null> = {
    id: 'a', label: 'a', space: 'screen',
    draw: vi.fn(),
  };
  runLayers(ctx, [layer], null, {}, undefined, { x: 5, y: 10, scale: 2 });
  expect(ctx.setTransform).toHaveBeenLastCalledWith(1, 0, 0, 1, 0, 0);
});
```

Stub must include `setTransform: vi.fn()`.

- [ ] **Step 3: Run + commit**

```bash
npm test -- src/core/layers/render.test.ts
git add src/core/layers/render.ts src/core/layers/render.test.ts
git commit -m "feat(layers): RenderLayer.draw takes view; world layers transform with scale"
```

---

## Task 4: Thread `view` through `defaultLayers` / scene `drawOne`

**Files:**
- Modify: `src/canvas/layers.ts`
- Modify: `src/canvas/Canvas.tsx` (the `drawOne` SceneSlotConfig type and the two call sites)
- Modify: `src/canvas/sceneAdapter.ts` (if it forwards `drawOne`)
- Modify: `src/canvas/SceneCanvas.tsx` (if it forwards `drawOne`)

`drawOne` becomes `(ctx, obj, pose, view)`. The scene+ghost layers in `defaultLayers` accept `view` as their third draw arg and pass it through to `drawOne`. The two `drawOne` invocation sites in Canvas (lines ~490 and ~519) pass `view` from their enclosing layer's draw arg.

- [ ] **Step 1: Update layers.ts**

```ts
// DefaultLayersScene.drawOne becomes:
drawOne: (ctx: CanvasRenderingContext2D, obj: TNode, pose: TPose, view: View) => void;

// Inside the scene draw:
draw: (ctx, _data, view) => {
  // …existing hide/effective logic…
  scene.drawOne(ctx, obj, pose, view);
},

// And inside the move-ghost draw:
draw: (ctx, _data, view) => {
  // …
  scene.drawOne(ctx, obj, pose, view);
},
```

- [ ] **Step 2: Update Canvas.tsx**

`SceneSlotConfig.drawOne` signature gains `view: View`. The two call sites become:

```ts
cfg.drawOne(ctx, obj, pose, view);
// …
drawOne(ctx, obj, pose, view);
```

Both are inside layer draw closures — wrap each existing draw function so it takes `(ctx, _data, view)` and passes `view` down.

- [ ] **Step 3: Update SceneCanvas + sceneAdapter**

If `SceneCanvas`/`sceneAdapter` define their own `drawOne`-shaped function, propagate the new `view` arg. Search:

```bash
rg -n 'drawOne' src/
```

Touch each definition.

- [ ] **Step 4: Update tests for new signatures**

Run the full suite; expect compile errors first, then test failures. Update test stubs to accept a 4th arg (drawOne) or 3rd arg (RenderLayer.draw). Add assertions in `Canvas.test.tsx` that `drawOne` receives the current `view`.

- [ ] **Step 5: Run + commit**

```bash
npm test
git add src/canvas/ src/core/layers/
git commit -m "feat(canvas): drawOne and RenderLayer.draw receive view arg"
```

---

## Task 5: Update Canvas internals for scale (default view, clientToWorld, runLayers call)

**Files:**
- Modify: `src/canvas/Canvas.tsx`
- Modify: `src/canvas/Canvas.test.tsx`

- [ ] **Step 1: Default view**

```ts
const [internalView, setInternalView] = useState<View>(defaultView ?? { x: 0, y: 0, scale: 1 });
```

- [ ] **Step 2: Default `clientToWorld`**

The current Canvas computes `worldX = (clientX - rect.left) + view.x`. Update to `/scale + view.x`:

```ts
if (overrides.clientX !== undefined) worldX = (overrides.clientX - rect.left) / view.scale + view.x;
if (overrides.clientY !== undefined) worldY = (overrides.clientY - rect.top) / view.scale + view.y;
```

And the consumer-facing `clientToWorld` default (around line 1188) likewise:

```ts
const cw = clientToWorld ?? ((c, cx, cy): [number, number] => {
  const rect = c.getBoundingClientRect();
  const v = viewRef.current;
  return [(cx - rect.left) / v.scale + v.x, (cy - rect.top) / v.scale + v.y];
});
```

- [ ] **Step 3: `runLayers` call already passes `effectiveView` (no change).**

- [ ] **Step 4: Test cases**

Add to `Canvas.test.tsx`:

```ts
it('clientToWorld accounts for view.scale', () => {
  // mount with view={x:5, y:5, scale:2}
  // simulate pointerdown at clientX=105 on a canvas at rect.left=0 (after scaling +5 origin)
  // worldX should be (105-0)/2 + 5 = 57.5
});
```

- [ ] **Step 5: Run + commit**

```bash
npm test -- src/canvas/Canvas.test.tsx
git add src/canvas/Canvas.tsx src/canvas/Canvas.test.tsx
git commit -m "feat(canvas): scale-aware default and clientToWorld"
```

---

## Task 6: `useWheelZoomTool`

**Files:**
- Create: `src/tools/builtin/useWheelZoomTool.ts`
- Test: `src/tools/builtin/useWheelZoomTool.test.ts`

Tool record: `id: 'wheel-zoom'`, alwaysOn slot. `wheel.onWheel` claims when `e.ctrlKey === true` (covers Cmd+wheel and trackpad pinch). Anchor: cursor relative to canvas; the dispatcher already passes the wheel event with `clientX/clientY` and the ctx's getCtx hook produces `worldX/worldY` — but we need the screen-relative anchor. Read it via `ctx.canvasRect` if exposed, otherwise compute from event + canvas the tool got via ctx.

Look first at how `ToolCtx` already exposes canvas geometry; if it doesn't, add a minimal `canvasRect: () => DOMRect | null` to ctx (in a sub-step). Plan A first: assume `ctx.view` is enough and the dispatcher gives anchor in screen px via `(e.clientX - rect.left)`. Concretely the wheel ctx should include the rect; if not present, add it.

- [ ] **Step 1: Decide on ctx shape**

Inspect `src/tools/types.ts` and `Canvas.tsx` `getCtx`. If `canvasRect` is not surfaced, add it to `ToolCtx` and populate from `Canvas.tsx`:

```ts
// types.ts
canvasRect: DOMRect;
```

Update DEFAULT_CTX with a stub `new DOMRect()`.

- [ ] **Step 2: Implement tool**

```ts
import { useMemo } from 'react';
import { defineTool } from '../defineTool';
import type { Tool } from '../types';
import { zoomAt } from '../../features/viewport/zoomAt';

export interface WheelZoomToolOpts {
  min?: number;
  max?: number;
  /** Multiplicative step per 100px of wheel delta. Default 1.1. */
  wheelStep?: number;
}

export function useWheelZoomTool(opts: WheelZoomToolOpts = {}): Tool<null> {
  const { min, max } = opts;
  const wheelStep = opts.wheelStep ?? 1.1;
  return useMemo(
    () => defineTool<null>({
      id: 'wheel-zoom',
      slot: 'alwaysOn',
      initScratch: () => null,
      wheel: {
        onWheel: (e, ctx) => {
          if (!e.ctrlKey) return 'pass';
          e.preventDefault();
          const rect = ctx.canvasRect;
          const anchor = { x: e.clientX - rect.left, y: e.clientY - rect.top };
          const factor = Math.pow(wheelStep, -e.deltaY / 100);
          ctx.setView(zoomAt(ctx.view, anchor, factor, { min, max }));
          return 'claim';
        },
      },
    }),
    [min, max, wheelStep],
  );
}
```

(The slot field is an assertion that this Tool wants to register in `alwaysOn` rather than the default active slot. If the existing Tool API doesn't have a `slot` field, then registration happens via `useTools({ alwaysOn: [tool] })` — match whichever pattern existing alwaysOn tools like `useUndoRedoTool` use.)

- [ ] **Step 3: Tests**

```ts
describe('useWheelZoomTool', () => {
  it('passes when ctrlKey is false', () => {
    // build a fake ctx with view {x:0,y:0,scale:1}, canvasRect at 0,0
    // dispatch onWheel with ctrlKey:false
    // expect 'pass', no setView call, no preventDefault
  });

  it('zooms about cursor anchor when ctrlKey is true', () => {
    // ctrlKey:true, deltaY:-100 (zoom in), clientX:100, clientY:50
    // expect setView called with zoomAt(...)
  });

  it('respects min/max from opts', () => { /* extreme deltaY clamps */ });

  it('calls preventDefault on claim', () => { /* spy on e.preventDefault */ });
});
```

- [ ] **Step 4: Run + commit**

```bash
npm test -- src/tools/builtin/useWheelZoomTool.test.ts
git add src/tools/builtin/useWheelZoomTool.ts src/tools/builtin/useWheelZoomTool.test.ts src/tools/types.ts
git commit -m "feat(tools): add useWheelZoomTool"
```

---

## Task 7: `useWheelPanTool`

**Files:**
- Create: `src/tools/builtin/useWheelPanTool.ts`
- Test: `src/tools/builtin/useWheelPanTool.test.ts`

Mirror of Task 6 but for plain (non-ctrl) wheel.

- [ ] **Step 1: Implement**

```ts
export function useWheelPanTool(): Tool<null> {
  return useMemo(
    () => defineTool<null>({
      id: 'wheel-pan',
      slot: 'alwaysOn',
      initScratch: () => null,
      wheel: {
        onWheel: (e, ctx) => {
          if (e.ctrlKey) return 'pass';
          e.preventDefault();
          const v = ctx.view;
          ctx.setView({
            x: v.x + e.deltaX / v.scale,
            y: v.y + e.deltaY / v.scale,
            scale: v.scale,
          });
          return 'claim';
        },
      },
    }),
    [],
  );
}
```

- [ ] **Step 2: Tests**

```ts
it('passes when ctrlKey is true', () => { … });
it('translates by (deltaX/scale, deltaY/scale)', () => {
  // view scale=2, deltaX=20, deltaY=10
  // expect setView with view.x +10, view.y +5
});
it('preserves scale', () => { … });
```

- [ ] **Step 3: Commit**

```bash
git add src/tools/builtin/useWheelPanTool.ts src/tools/builtin/useWheelPanTool.test.ts
git commit -m "feat(tools): add useWheelPanTool"
```

---

## Task 8: `useKeyboardZoomTool`

**Files:**
- Create: `src/tools/builtin/useKeyboardZoomTool.ts`
- Test: `src/tools/builtin/useKeyboardZoomTool.test.ts`

Anchor: canvas center. Reads `ctx.canvasRect` for size.

- [ ] **Step 1: Implement**

```ts
export interface KeyboardZoomToolOpts {
  min?: number;
  max?: number;
  /** Multiplicative step per Cmd+= / Cmd+- press. Default 1.25. */
  keyStep?: number;
}

export function useKeyboardZoomTool(opts: KeyboardZoomToolOpts = {}): Tool<null> {
  const { min, max } = opts;
  const keyStep = opts.keyStep ?? 1.25;
  return useMemo(
    () => defineTool<null>({
      id: 'keyboard-zoom',
      slot: 'alwaysOn',
      initScratch: () => null,
      keyboard: {
        onDown: (e, ctx) => {
          if (!(e.metaKey || e.ctrlKey)) return 'pass';
          const rect = ctx.canvasRect;
          const center = { x: rect.width / 2, y: rect.height / 2 };
          if (e.key === '=' || e.key === '+') {
            e.preventDefault();
            ctx.setView(zoomAt(ctx.view, center, keyStep, { min, max }));
            return 'claim';
          }
          if (e.key === '-' || e.key === '_') {
            e.preventDefault();
            ctx.setView(zoomAt(ctx.view, center, 1 / keyStep, { min, max }));
            return 'claim';
          }
          if (e.key === '0') {
            e.preventDefault();
            ctx.setView({ x: 0, y: 0, scale: 1 });
            return 'claim';
          }
          return 'pass';
        },
      },
    }),
    [min, max, keyStep],
  );
}
```

- [ ] **Step 2: Tests**

```ts
it('Cmd+= zooms in about canvas center', () => { … });
it('Cmd+- zooms out about canvas center', () => { … });
it('Cmd+0 resets to identity', () => { … });
it('passes plain keys without modifier', () => { … });
```

- [ ] **Step 3: Commit**

```bash
git add src/tools/builtin/useKeyboardZoomTool.ts src/tools/builtin/useKeyboardZoomTool.test.ts
git commit -m "feat(tools): add useKeyboardZoomTool"
```

---

## Task 9: Re-export new tools and `zoomAt`

**Files:**
- Modify: `src/tools/builtin/index.ts`
- Modify: `src/index.ts`

- [ ] **Step 1: Update barrels**

```ts
// src/tools/builtin/index.ts
export { useWheelZoomTool } from './useWheelZoomTool';
export type { WheelZoomToolOpts } from './useWheelZoomTool';
export { useWheelPanTool } from './useWheelPanTool';
export { useKeyboardZoomTool } from './useKeyboardZoomTool';
export type { KeyboardZoomToolOpts } from './useKeyboardZoomTool';
```

```ts
// src/index.ts — add:
export { zoomAt } from './features/viewport/zoomAt';
export type { ZoomClampOpts } from './features/viewport/zoomAt';
// (the three tools come through the tools subpath barrel; ensure they're surfaced)
```

- [ ] **Step 2: Commit**

```bash
git add src/tools/builtin/index.ts src/index.ts
git commit -m "feat(barrel): export zoomAt and zoom/pan tools"
```

---

## Task 10: Flip selection overlay to `space: 'screen'`

**Files:**
- Modify: `src/features/selection/overlay.ts`
- Modify: `src/features/selection/overlay.test.ts`

The four created layers (`createSelectionOutlineLayer`, `createSelectionHandlesLayer`, `createSelectionOverlayLayer`, plus the convenience layer in Canvas) all need:

1. `space: 'screen'` on the returned RenderLayer.
2. Their `draw` accepts `view` (already required by Task 3).
3. Each world-space coordinate (`b.x`, `b.y`, `b.x + b.width`, etc.) is mapped through `worldToScreen(pt, viewToTransform(view))` before issuing the draw call.
4. Stroke widths and handle sizes stay in screen px (no division — they're already screen px).
5. Padding (`pad`) was world px; convert to screen px by multiplying by `view.scale` so visual outset stays constant — *or* keep pad as screen px and document the change. Preferred: pad stays screen px (simpler, matches "this is screen chrome"). Document in JSDoc.

- [ ] **Step 1: Refactor `drawOutlines` to project**

```ts
function drawOutlines(
  ctx: CanvasRenderingContext2D,
  ids: string[],
  resolveBounds: (id: string) => Bounds | null,
  stroke: Stroke,
  pad: number,
  view: View,
): void {
  const t = viewToTransform(view);
  // …
  for (const id of ids) {
    const b = resolveBounds(id);
    if (!b) continue;
    const [sx, sy] = worldToScreen(b.x, b.y, t);
    const sw = b.width * view.scale;
    const sh = b.height * view.scale;
    const padded = { x: sx - pad, y: sy - pad, width: sw + pad * 2, height: sh + pad * 2 };
    // …existing alignedStrokeRect + rotation logic, but rotated about the screen-projected center
  }
}
```

Repeat in `drawHandles` and `drawRotationHandle`.

- [ ] **Step 2: Add `space: 'screen'` to each returned layer**

```ts
return {
  id: 'selection-overlay',
  label: 'Selection',
  space: 'screen',
  draw: (ctx, _data, view) => { … },
};
```

- [ ] **Step 3: Update tests**

`overlay.test.ts` cases now stub a `view`. Add scale=2 case asserting handle squares are drawn at the configured size (not 2× because of scale) but at screen-projected positions.

- [ ] **Step 4: Run + commit**

```bash
npm test -- src/features/selection/overlay.test.ts
git add src/features/selection/overlay.ts src/features/selection/overlay.test.ts
git commit -m "feat(selection): selection overlay layers run in screen space"
```

---

## Task 11: Flip insert/area-select overlay layers to screen space

**Files:**
- Modify: `src/canvas/Canvas.tsx` (`buildInsertOverlayLayer`, `buildAreaSelectOverlayLayer`)
- Modify: `src/canvas/Canvas.test.tsx`

Both currently draw with raw world coords (e.g. `ctx.fillRect(overlay.bounds.x, overlay.bounds.y, w, h)`). Convert to screen via `worldToScreen` and add `space: 'screen'`.

- [ ] **Step 1: Update `buildInsertOverlayLayer`**

```ts
return {
  id: 'insert-overlay',
  label: 'Insert overlay',
  space: 'screen',
  draw: (ctx, _data, view) => {
    const t = viewToTransform(view);
    const { x, y, width: w, height: h } = overlay.bounds;
    const [sx, sy] = worldToScreen(x, y, t);
    const sw = w * view.scale;
    const sh = h * view.scale;
    ctx.save();
    ctx.fillStyle = fill;
    ctx.fillRect(sx, sy, sw, sh);
    ctx.strokeStyle = stroke;
    ctx.lineWidth = lineWidth;
    ctx.setLineDash(dash);
    ctx.strokeRect(sx, sy, sw, sh);
    ctx.setLineDash([]);
    ctx.restore();
  },
};
```

- [ ] **Step 2: Update `buildAreaSelectOverlayLayer`**

Same pattern — its `overlay.start.worldX` / `overlay.current.worldX` are in world coords already, so convert.

- [ ] **Step 3: Tests**

Add a Canvas integration test at scale=2 that mounts an insert overlay and asserts the drawn rect's screen position.

- [ ] **Step 4: Commit**

```bash
git add src/canvas/Canvas.tsx src/canvas/Canvas.test.tsx
git commit -m "feat(canvas): insert + area-select overlays run in screen space"
```

---

## Task 12: Flip `handleHitRadius` to screen-px semantics

**Files:**
- Modify: `src/interactions/usePointerGestures.ts`
- Modify: `src/interactions/usePointerGestures.test.ts`
- Modify: `src/tools/builtin/useSelectTool.ts`
- Modify: `src/tools/builtin/useSelectTool.test.ts`

The compare semantics: today `hitCornerHandle(h, wx, wy, handleHitRadius)` treats `handleHitRadius` as world units. Flip: divide by current `view.scale` before comparing so the radius is interpreted as screen px.

- [ ] **Step 1: usePointerGestures**

The hook needs access to current view. Add a `getView?: () => View` option (defaults to identity). At hit time:

```ts
const v = getView ? getView() : { x:0, y:0, scale:1 };
const radiusWorld = handleHitRadius / v.scale;
if (hitCornerHandle(h, wx, wy, radiusWorld)) { … }
```

Same change for rotation-handle hit.

- [ ] **Step 2: useSelectTool**

```ts
const radiusWorld = handleHitRadius / ctx.view.scale;
if (hitRotationHandle(handle, ctx.worldX, ctx.worldY, radiusWorld)) { … }
if (hitCornerHandle(h, ctx.worldX, ctx.worldY, radiusWorld)) { … }
```

- [ ] **Step 3: Canvas wiring**

Pass `getView: () => viewRef.current` into `usePointerGestures` from `Canvas.tsx`.

- [ ] **Step 4: Tests**

Add scale=2 cases to both test files: a hit at the edge of an 8px screen-radius handle is detected at scale=2 (i.e. world distance 4).

- [ ] **Step 5: Commit**

```bash
npm test -- src/interactions/usePointerGestures.test.ts src/tools/builtin/useSelectTool.test.ts
git add src/interactions/usePointerGestures.ts src/interactions/usePointerGestures.test.ts src/tools/builtin/useSelectTool.ts src/tools/builtin/useSelectTool.test.ts src/canvas/Canvas.tsx
git commit -m "feat(hit-test): handleHitRadius is screen-px semantics"
```

---

## Task 13: Integration test — wheel zoom + wheel pan + keyboard zoom + hand

**Files:**
- Modify: `src/tools/builtin/integration.test.tsx`

- [ ] **Step 1: Add suite**

```ts
describe('zoom + pan composition', () => {
  it('ctrl+wheel zooms about cursor', () => { … });
  it('plain wheel pans by deltaX/scale', () => { … });
  it('Cmd+= zooms in; Cmd+0 resets', () => { … });
  it('hand drag still pans after a zoom in', () => {
    // zoom to scale=2, then drag — verify pan delta is (dx, dy) in screen px
    // (so view.x changes by dx; the hand tool deliberately works in screen px)
  });
});
```

For the hand-after-zoom case: since `useHandTool` uses `dx = clientX - startClientX` and writes `startView.x - dx`, the *view* always moves in screen px regardless of scale — confirm that's the behavior we want (the user sees their pointer track the world content one-for-one in screen px). This is the desired behavior per spec.

- [ ] **Step 2: Run + commit**

```bash
npm test -- src/tools/builtin/integration.test.tsx
git add src/tools/builtin/integration.test.tsx
git commit -m "test(tools): zoom + pan + hand integration"
```

---

## Task 14: ZoomDemo

**Files:**
- Create: `demo/demos/ZoomDemo.tsx`
- Modify: `demo/registry.ts`

- [ ] **Step 1: Implement**

```tsx
// demo/demos/ZoomDemo.tsx
import { Canvas } from '@weasel-js/core';
import {
  useTools, useKeybindings, useHandTool,
  useWheelZoomTool, useWheelPanTool, useKeyboardZoomTool,
  useSelectTool,
} from '@weasel-js/core/tools';
// …
```

Two objects on the canvas: one drawn with `ctx.lineWidth = 2 / view.scale` (screen-pinned stroke), one with plain `ctx.lineWidth = 2` (world stroke). Side-by-side legend shows the difference under zoom.

- [ ] **Step 2: Register**

Add `ZoomDemo` to `demo/registry.ts`.

- [ ] **Step 3: Manual smoke**

`npm run dev`, open the demo, scroll-zoom (cmd+wheel), trackpad-pinch, plain-wheel-pan, hold space + drag, press H + drag, press Cmd+=/-/0. Confirm chrome stays screen-px constant under zoom.

- [ ] **Step 4: Commit**

```bash
git add demo/demos/ZoomDemo.tsx demo/registry.ts
git commit -m "demo: ZoomDemo wires zoom + pan + hand + select"
```

---

## Task 15: Delete `usePan` and update barrel

**Files:**
- Delete: `src/features/viewport/usePan.ts`
- Delete: `src/features/viewport/usePan.test.ts` (if exists)
- Modify: `src/index.ts`
- Modify: `CHANGELOG.md`

- [ ] **Step 1: Verify no source references usePan**

```bash
rg -n 'usePan|ActivePan' src/ demo/
```

Expect only `src/features/viewport/usePan.ts` itself. Outside-of-src references in docs (`docs/specs/2026-05-03-viewport-and-hand-tool-design.md`, `docs/TODO.md`) are fine to leave as historical record.

- [ ] **Step 2: Delete files**

```bash
rm src/features/viewport/usePan.ts
rm -f src/features/viewport/usePan.test.ts
```

- [ ] **Step 3: Drop barrel exports**

In `src/index.ts` remove the `usePan` re-export line.

- [ ] **Step 4: CHANGELOG**

Add an "Unreleased" section noting the breaking changes:

```markdown
### Breaking
- `View` now includes `scale: number` (default 1).
- `RenderLayer.draw` signature is `(ctx, data, view) => void`.
- `SceneSlotConfig.drawOne` signature is `(ctx, obj, pose, view) => void`.
- `handleHitRadius` is now interpreted in screen pixels.
- `usePan` is removed; use `useHandTool` (drag-pan) and `useWheelPanTool` (wheel-pan).
```

- [ ] **Step 5: Run full suite + commit**

```bash
npm test
npm run typecheck   # if defined
git add -A
git commit -m "feat(viewport): remove usePan; CHANGELOG for Phase 2c breaking changes"
```

---

## Self-review checklist

Before declaring done:

- [ ] Every `View` literal in source includes `scale`.
- [ ] Every `RenderLayer.draw` call site receives 3 args.
- [ ] Every `drawOne` definition + call site has 4 args.
- [ ] Every screen-space layer factory tags `space: 'screen'` and uses `worldToScreen(...)` for all positioning.
- [ ] `handleHitRadius` is divided by `view.scale` at every hit-test site.
- [ ] No grep hits for `usePan` in `src/`.
- [ ] CHANGELOG updated.
- [ ] ZoomDemo manually exercised.
