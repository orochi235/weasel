# Tool Primitive — Phase 2b: Viewport (pan-only) + Hand Tool — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give `<Canvas>` a real pan-able viewport and ship a `hand` Tool that drives it (active slot via `H` key, modifier slot via `space`).

**Architecture:** Canvas accepts hybrid uncontrolled/controlled `view`/`defaultView`/`onViewChange` props. `View = {x, y}` represents the world point at the canvas top-left (camera-position convention). `RenderLayer` gains an optional `space?: 'world' | 'screen'` field; `runLayers` accepts an optional `view` param and wraps each `'world'` layer's draw with `ctx.save()/translate(-view.x, -view.y)/restore()`. Pointer→world conversion routes client coords through `(clientX - rect.left) + view.x`. `useHandTool` is a single Tool record registered in both slots; its drag handlers compute pan deltas inline (no reuse of legacy `usePan`).

**Tech Stack:** TypeScript, React 18, vitest, jsdom, @testing-library/react. Test runner: `npm test` (vitest). Existing kit primitives reused: `ViewTransform`, `worldToScreen`, `screenToWorld`, `defineTool`, `createToolsDispatcher`. Spec: `docs/specs/2026-05-03-viewport-and-hand-tool-design.md`.

---

## File Structure

| File | Status | Purpose |
| --- | --- | --- |
| `src/features/viewport/view.ts` | NEW | `View` interface + `viewToTransform()` adapter to bridge to legacy `ViewTransform`. |
| `src/features/viewport/view.test.ts` | NEW | Adapter math + sign-convention guards. |
| `src/core/layers/render.ts` | MODIFY | Add `space?: 'world' \| 'screen'` to `RenderLayer`; extend `runLayers` with optional `view` arg that wraps draw with translate. |
| `src/core/layers/render.test.ts` | MODIFY | Cover legacy-mode (no view), world-layer translation, screen-layer no-translate, default-space. |
| `src/tools/types.ts` | MODIFY | Add `view: View` and `setView: (v: View) => void` to `ToolCtx`. |
| `src/tools/dispatcher.ts` | MODIFY | Rename `getCtx` overrides from `{worldX, worldY}` to `{clientX, clientY}` (the values were always client coords, just mislabeled). |
| `src/tools/useTools.ts` | MODIFY | `DEFAULT_CTX` includes view+setView no-ops; `getCtx` shape updated for new override field names. |
| `src/canvas/Canvas.tsx` | MODIFY | Add `view`/`defaultView`/`onViewChange` props; internal state; `viewRef`; project client→world in `toolsCtxBase` using `view`; pass `view` to `runLayers`; expose `setView` on `ToolCtx`. |
| `src/canvas/Canvas.test.tsx` | MODIFY | Controlled vs uncontrolled view; `onViewChange` fires; `worldX/Y` reflect view. |
| `src/tools/builtin/useHandTool.ts` | NEW | Hand tool — drag-pans, registered active+modifier. |
| `src/tools/builtin/useHandTool.test.ts` | NEW | Pan math, sign convention, scratch lifecycle, cursor. |
| `src/tools/builtin/index.ts` | MODIFY | Re-export `useHandTool`. |
| `src/features/viewport/usePan.ts` | MODIFY | Add `@deprecated` JSDoc. |
| `src/tools/builtin/integration.test.tsx` | MODIFY | Add: H switches to hand + drag pans; space momentary engages then disengages; select still works when hand inactive. |
| `demo/demos/PanDemo.tsx` | NEW | Minimal pan demo wiring `useHandTool` + `useTools` + `useKeybindings` + `<Canvas>` viewport props. |
| `demo/CanvasKitDemo.tsx` | MODIFY | Register `PanDemo` in the demo router. |

---

## Task 1: `View` type + `viewToTransform` adapter

**Files:**
- Create: `src/features/viewport/view.ts`
- Test: `src/features/viewport/view.test.ts`

`View` is the kit's new viewport state shape. The adapter exists because the spec settled on "camera position" semantics (`screenX = worldX - view.x`) but the existing `ViewTransform` uses additive convention (`screenX = panX + worldX * zoom`). Chrome that wants to call `worldToScreen(...)` converts via the adapter rather than re-deriving inline.

- [ ] **Step 1: Write the failing test**

`src/features/viewport/view.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import type { View } from './view';
import { viewToTransform } from './view';
import { worldToScreen, screenToWorld } from './viewTransform';

describe('viewToTransform', () => {
  it('inverts the camera-position convention into ViewTransform pan', () => {
    const view: View = { x: 100, y: 50 };
    const t = viewToTransform(view);
    expect(t).toEqual({ panX: -100, panY: -50, zoom: 1 });
  });

  it('round-trips world↔screen with worldToScreen using the adapter', () => {
    const view: View = { x: 30, y: -20 };
    const t = viewToTransform(view);
    // World point that is at the camera-top-left should map to screen (0, 0).
    expect(worldToScreen(view.x, view.y, t)).toEqual([0, 0]);
    // And inversely.
    expect(screenToWorld(0, 0, t)).toEqual([view.x, view.y]);
  });

  it('zero view is identity', () => {
    expect(viewToTransform({ x: 0, y: 0 })).toEqual({ panX: 0, panY: 0, zoom: 1 });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```
npm test -- src/features/viewport/view.test.ts
```

Expected: FAIL — module `./view` not found.

- [ ] **Step 3: Write minimal implementation**

`src/features/viewport/view.ts`:

```ts
import type { ViewTransform } from './viewTransform';

/**
 * Viewport state in camera-position semantics. `view = {x, y}` is the
 * **world point currently rendered at the canvas top-left**. So:
 *
 *   screenX = worldX - view.x
 *   worldX  = screenX + view.x
 *
 * Phase 2b is pan-only — there is no scale field. Phase 2c will extend
 * this shape with `scale` (and the formulas with multiplication).
 */
export interface View {
  x: number;
  y: number;
}

/**
 * Bridge `View` into the legacy `ViewTransform` shape so chrome can keep
 * calling `worldToScreen` / `screenToWorld`. `View` and `ViewTransform`
 * use opposite sign conventions for the translation half (`view.x` is
 * camera position; `panX` is canvas translation), so the adapter flips
 * the sign. `zoom` is hard-coded to 1 — Phase 2c lifts that.
 */
export function viewToTransform(view: View): ViewTransform {
  return { panX: -view.x, panY: -view.y, zoom: 1 };
}
```

- [ ] **Step 4: Run test to verify it passes**

```
npm test -- src/features/viewport/view.test.ts
```

Expected: PASS — 3 passed.

- [ ] **Step 5: Commit**

```bash
git add src/features/viewport/view.ts src/features/viewport/view.test.ts
git commit -m "feat(viewport): View type + viewToTransform adapter

Camera-position viewport shape (\`View = {x, y}\` is the world point at
canvas top-left). Adapter bridges to legacy \`ViewTransform\` for chrome
that already uses worldToScreen / screenToWorld."
```

---

## Task 2: `RenderLayer.space` + `runLayers` view-aware translation

**Files:**
- Modify: `src/core/layers/render.ts`
- Test: `src/core/layers/render.test.ts`

Add `space?: 'world' | 'screen'` to `RenderLayer`. Extend `runLayers` with an optional 6th `view?: View` arg. When `view` is supplied: each `'world'` layer (default) is wrapped in `ctx.save()/translate(-view.x, -view.y)/restore()`. `'screen'` layers are wrapped in `ctx.save()/restore()` only (so layers that mutate transforms can't leak). When `view` is omitted, behavior is unchanged from today (legacy/back-compat for any caller that doesn't pan).

Composing on the existing transform via `translate` (rather than `setTransform`) preserves the DPR scale that `setupCanvasDpr` installed.

- [ ] **Step 1: Write the failing test**

Append to `src/core/layers/render.test.ts`:

```ts
import { describe, it, expect, vi } from 'vitest';
import { runLayers, type RenderLayer } from './render';

describe('runLayers — view-aware translation', () => {
  function makeCtx() {
    const calls: string[] = [];
    const ctx = {
      save: vi.fn(() => calls.push('save')),
      restore: vi.fn(() => calls.push('restore')),
      translate: vi.fn((x: number, y: number) => calls.push(`translate(${x},${y})`)),
    } as unknown as CanvasRenderingContext2D;
    return { ctx, calls };
  }

  it('legacy: when view is omitted, no save/translate/restore wrapping', () => {
    const { ctx, calls } = makeCtx();
    const draw = vi.fn();
    const layers: RenderLayer<unknown>[] = [{ id: 'a', label: 'a', draw }];
    runLayers(ctx, layers, null, {});
    expect(draw).toHaveBeenCalledTimes(1);
    expect(calls).toEqual([]);
  });

  it('world layer (default): translates by -view.x, -view.y around draw', () => {
    const { ctx, calls } = makeCtx();
    const draw = vi.fn();
    const layers: RenderLayer<unknown>[] = [{ id: 'a', label: 'a', draw }];
    runLayers(ctx, layers, null, {}, undefined, { x: 10, y: 20 });
    expect(calls).toEqual(['save', 'translate(-10,-20)', 'restore']);
  });

  it('screen layer: save/restore only (no translate)', () => {
    const { ctx, calls } = makeCtx();
    const draw = vi.fn();
    const layers: RenderLayer<unknown>[] = [
      { id: 'a', label: 'a', draw, space: 'screen' },
    ];
    runLayers(ctx, layers, null, {}, undefined, { x: 10, y: 20 });
    expect(calls).toEqual(['save', 'restore']);
  });

  it('explicit space: world is equivalent to default', () => {
    const { ctx, calls } = makeCtx();
    const draw = vi.fn();
    const layers: RenderLayer<unknown>[] = [
      { id: 'a', label: 'a', draw, space: 'world' },
    ];
    runLayers(ctx, layers, null, {}, undefined, { x: 5, y: 0 });
    expect(calls).toEqual(['save', 'translate(-5,-0)', 'restore']);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```
npm test -- src/core/layers/render.test.ts
```

Expected: FAIL — `runLayers` does not accept a 6th `view` arg; `RenderLayer` has no `space` field.

- [ ] **Step 3: Write minimal implementation**

Replace `src/core/layers/render.ts` contents:

```ts
import type { View } from '../../features/viewport/view';

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
  /** Draw this layer's content onto the canvas. */
  draw: (ctx: CanvasRenderingContext2D, data: TData) => void;
  /**
   * Whether the layer is shown when no explicit visibility entry exists.
   * Defaults to `true` when absent.
   */
  defaultVisible?: boolean;
  /**
   * When true, the layer is always drawn regardless of the visibility map.
   * Useful for layers that must never be hidden (e.g. base grid).
   */
  alwaysOn?: boolean;
  /**
   * Coordinate space the layer draws in. When `runLayers` is called with a
   * `view`, world-space layers (default) are wrapped in a translate so the
   * draw can use world coords directly. Screen-space layers receive only a
   * save/restore — they're responsible for any world↔screen projection.
   * Default: `'world'`.
   */
  space?: 'world' | 'screen';
}

/**
 * Iterate layers and call `draw` for each visible one.
 *
 * Visibility resolution order:
 *   1. `alwaysOn` — always drawn, ignores visibility map.
 *   2. Explicit entry in `visibility` map — overrides default.
 *   3. `layer.defaultVisible` — falls back to `true` when absent.
 *
 * Viewport: when `view` is supplied, each layer's draw is wrapped:
 *   - `space: 'world'` (default) → ctx.save(); ctx.translate(-view.x, -view.y); draw(); ctx.restore()
 *   - `space: 'screen'`          → ctx.save();                                    draw(); ctx.restore()
 *
 * When `view` is omitted, draws run unwrapped (legacy behavior).
 */
export function runLayers<TData>(
  ctx: CanvasRenderingContext2D,
  layers: RenderLayer<TData>[],
  data: TData,
  visibility: Record<string, boolean>,
  order?: string[],
  view?: View,
): void {
  const layerById = new Map(layers.map((l) => [l.id, l]));

  const sequence = order
    ? order.map((id) => layerById.get(id)).filter((l): l is RenderLayer<TData> => l !== undefined)
    : layers;

  for (const layer of sequence) {
    const visible =
      layer.alwaysOn ||
      (layer.id in visibility ? visibility[layer.id] : (layer.defaultVisible ?? true));

    if (!visible) continue;

    if (view === undefined) {
      layer.draw(ctx, data);
      continue;
    }

    ctx.save();
    if ((layer.space ?? 'world') === 'world') {
      ctx.translate(-view.x, -view.y);
    }
    layer.draw(ctx, data);
    ctx.restore();
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

```
npm test -- src/core/layers/render.test.ts
```

Expected: PASS — all existing tests + 4 new ones pass.

- [ ] **Step 5: Commit**

```bash
git add src/core/layers/render.ts src/core/layers/render.test.ts
git commit -m "feat(layers): RenderLayer.space + runLayers view-aware translation

Optional 'space' field on RenderLayer ('world' default, 'screen' opt-in).
runLayers gains optional 'view' arg that wraps each draw in
save/translate(-view.x,-view.y)/restore for world layers, save/restore
only for screen layers. Legacy callers (no view) are unaffected."
```

---

## Task 3: `ToolCtx` view + setView fields

**Files:**
- Modify: `src/tools/types.ts`
- Test: covered by Task 6 (Canvas integration); no isolated test for the type addition

Add `view: View` and `setView: (next: View) => void` to `ToolCtx`. This is a pure type addition — fully consumed in Task 6. Default no-ops are added to `useTools`'s `DEFAULT_CTX` in Task 5 so existing tests don't fail.

- [ ] **Step 1: Modify `src/tools/types.ts`**

Add the import at the top of the file (after the existing `Op` import):

```ts
import type { View } from '../features/viewport/view';
```

Inside the `ToolCtx<TScratch>` interface (after the existing `applyBatch` field, before `scratch`):

```ts
  /** Current viewport. Reflects camera-position semantics — see
   *  `View` JSDoc. Phase 2b is pan-only. */
  view: View;
  /** Mutate the viewport. In controlled mode this calls the consumer's
   *  `onViewChange`; in uncontrolled mode it updates Canvas's internal
   *  state. View changes are not undoable. */
  setView: (next: View) => void;
```

- [ ] **Step 2: Run typecheck — expect failures from `useTools`/Canvas**

```
npm test -- --run src/tools 2>&1 | head -40
```

Expected: FAIL — `DEFAULT_CTX` in `useTools.ts` is missing `view` and `setView` fields. (Type error surfaces at the spread site.) That's fixed in Task 5.

- [ ] **Step 3: Commit**

```bash
git add src/tools/types.ts
git commit -m "feat(tools): add view + setView to ToolCtx

Tools that need viewport access read/write through ctx rather than
prop-drilling. Concrete wiring in Canvas + DEFAULT_CTX in useTools
follows in subsequent tasks."
```

(Type errors in dependent files are intentional and resolved by Tasks 4–6.)

---

## Task 4: `dispatcher.getCtx` overrides — rename to clientX/clientY

**Files:**
- Modify: `src/tools/dispatcher.ts`
- Test: existing `src/tools/dispatcher.test.ts` should keep passing after the rename (none of the existing tests assert override field names).

The `getCtx` overrides accept the values `e.clientX, e.clientY` from pointer events but their parameter names are `worldX, worldY` — actively misleading. Phase 2b makes Canvas's `getCtx` actually project client→world using the current view, so the field names need to match what the dispatcher passes.

- [ ] **Step 1: Modify the `ToolsDispatcherOptions.getCtx` signature**

In `src/tools/dispatcher.ts`, change:

```ts
  getCtx: (overrides?: { worldX?: number; worldY?: number }) => Omit<ToolCtx, 'scratch'>;
```

to:

```ts
  getCtx: (overrides?: { clientX?: number; clientY?: number }) => Omit<ToolCtx, 'scratch'>;
```

- [ ] **Step 2: Update all call sites in the same file**

In `onPointerDown` (was `worldX: e.clientX, worldY: e.clientY`), change to:

```ts
    const baseCtx = opts.getCtx({ clientX: e.clientX, clientY: e.clientY });
```

In `onPointerMove` (twice — once in pending, once in drag), change to:

```ts
    const baseCtx = opts.getCtx({ clientX: e.clientX, clientY: e.clientY });
```

In `onPointerUp`:

```ts
    const baseCtx = opts.getCtx({ clientX: e.clientX, clientY: e.clientY });
```

In `onWheel`:

```ts
    const base = opts.getCtx({ clientX: e.clientX, clientY: e.clientY });
```

`onKeyDown`/`onKeyUp` already call `opts.getCtx()` without overrides — leave unchanged.

- [ ] **Step 3: Run dispatcher tests**

```
npm test -- src/tools/dispatcher.test.ts
```

Expected: PASS (8 tests). The override is internal — no existing test asserts the field names.

- [ ] **Step 4: Commit**

```bash
git add src/tools/dispatcher.ts
git commit -m "refactor(tools): rename dispatcher getCtx overrides to clientX/clientY

The values were always client coords (e.clientX/e.clientY), just
mislabeled as world. Phase 2b's Canvas getCtx projects client→world
using the active view, so the override names need to be honest."
```

---

## Task 5: `useTools` `DEFAULT_CTX` — view + setView no-ops; getCtx override shape

**Files:**
- Modify: `src/tools/useTools.ts`
- Test: existing `src/tools/useTools.test.ts` keeps passing.

After Task 3, `DEFAULT_CTX` is missing `view`/`setView` and won't typecheck. This task adds inert defaults so tests that don't care about viewport keep working, and updates the local override-shape comment to match the new dispatcher contract.

- [ ] **Step 1: Modify `DEFAULT_CTX` in `src/tools/useTools.ts`**

After the `adapter: null,` line and before the existing `applyBatch: () => {},`, add:

```ts
  view: { x: 0, y: 0 },
  setView: () => {},
```

(So `DEFAULT_CTX` becomes a complete `Omit<ToolCtx, 'scratch'>` with all six fields.)

- [ ] **Step 2: Update `getCtx` shape in the dispatcher options**

Inside the `createToolsDispatcher({...})` call, the inline `getCtx` is `(overrides) => { ... }`. The override shape is now `{clientX?, clientY?}` (Task 4) but `useTools` itself doesn't care about projection — it just spreads the override into the base. Change:

```ts
        getCtx: (overrides) => {
          const base = getCtxRef.current ? getCtxRef.current() : DEFAULT_CTX;
          return overrides ? { ...base, ...overrides } : base;
        },
```

to:

```ts
        getCtx: (overrides) => {
          const base = getCtxRef.current ? getCtxRef.current() : DEFAULT_CTX;
          // Pass-through: Canvas's getCtx (when wired) accepts the same
          // override shape and is responsible for projecting clientX/clientY
          // into worldX/worldY using the current view. When getCtx isn't
          // wired (test-only DEFAULT_CTX path), drop the overrides — the
          // default has no useful coords.
          if (!overrides || !getCtxRef.current) return base;
          return { ...base, ...overrides };
        },
```

(The non-wired test path drops the overrides because spreading `clientX/clientY` into a `ToolCtx` would put non-existent fields on the ctx; `worldX/Y` stay at 0/0 which is what tests already expect.)

Wait — that spread would put `clientX/clientY` keys on the base ctx, which isn't a `ToolCtx` shape. Cleaner: when `getCtxRef.current` is wired, *trust it* to handle overrides itself by passing through. So:

Replace the body with:

```ts
        getCtx: (overrides) => {
          if (getCtxRef.current) return getCtxRef.current(overrides);
          return DEFAULT_CTX;
        },
```

And update the `getCtx` field type on `UseToolsOptions` (the public hook contract) to accept the same overrides:

```ts
  getCtx?: (overrides?: { clientX?: number; clientY?: number }) => Omit<ToolCtx, 'scratch'>;
```

- [ ] **Step 3: Run tools tests**

```
npm test -- src/tools/
```

Expected: PASS — all existing tools tests pass.

- [ ] **Step 4: Commit**

```bash
git add src/tools/useTools.ts
git commit -m "feat(tools): wire view/setView through useTools getCtx

DEFAULT_CTX gains inert view/setView so the test-only path stays valid
ToolCtx. Public getCtx now passes overrides straight to the consumer-
supplied projector; the dispatcher's clientX/clientY override shape is
projected to worldX/worldY by Canvas in Task 6."
```

---

## Task 6: Canvas viewport state + project client→world + pass view to runLayers + setView on ctx

**Files:**
- Modify: `src/canvas/Canvas.tsx`
- Test: `src/canvas/Canvas.test.tsx` (add cases)

This is the largest task — single commit, four sub-changes that need to land together to keep Canvas type-checking.

The four sub-changes:
1. Add `view`/`defaultView`/`onViewChange` props + internal state + a `viewRef` that always points at the current value.
2. Project client→world inside `toolsCtxBase` using the current view; surface `setView` on `ctx`.
3. Pass `viewRef.current` as the 6th arg to `runLayers` in the render effect.
4. Add a `viewRef.current` read into the render effect's deps so a controlled `view` prop change retriggers paint.

- [ ] **Step 1: Write the failing tests**

Append to `src/canvas/Canvas.test.tsx` (use the existing test file conventions — render via `@testing-library/react`, ctx stub already established for jsdom):

```ts
import { describe, it, expect, vi } from 'vitest';
import { render, fireEvent, act } from '@testing-library/react';
import React, { useState } from 'react';
import { Canvas } from './Canvas';

describe('Canvas viewport (Phase 2b)', () => {
  function noopScene() {
    return { drawOne: () => {} } as const;
  }

  it('uncontrolled: defaults to {x:0,y:0} and is internally mutable', () => {
    const onViewChange = vi.fn();
    const { container } = render(
      <Canvas
        width={100}
        height={100}
        items={[]}
        setItems={() => {}}
        layers={{ scene: noopScene() }}
        onViewChange={onViewChange}
      />,
    );
    // Initial value is {0,0}; onViewChange not yet called.
    expect(onViewChange).not.toHaveBeenCalled();
    expect(container.querySelector('canvas')).toBeTruthy();
  });

  it('uncontrolled: defaultView seeds initial state', () => {
    const onViewChange = vi.fn();
    render(
      <Canvas
        width={100}
        height={100}
        items={[]}
        setItems={() => {}}
        layers={{ scene: noopScene() }}
        defaultView={{ x: 50, y: 25 }}
        onViewChange={onViewChange}
      />,
    );
    expect(onViewChange).not.toHaveBeenCalled();
  });

  it('controlled: passing view + onViewChange honors the prop on render', () => {
    const onViewChange = vi.fn();
    const { rerender } = render(
      <Canvas
        width={100}
        height={100}
        items={[]}
        setItems={() => {}}
        layers={{ scene: noopScene() }}
        view={{ x: 10, y: 20 }}
        onViewChange={onViewChange}
      />,
    );
    rerender(
      <Canvas
        width={100}
        height={100}
        items={[]}
        setItems={() => {}}
        layers={{ scene: noopScene() }}
        view={{ x: 30, y: 40 }}
        onViewChange={onViewChange}
      />,
    );
    // No assertion on draw side — view prop change just shouldn't throw.
    expect(onViewChange).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run tests to verify failure**

```
npm test -- src/canvas/Canvas.test.tsx
```

Expected: FAIL — Canvas doesn't accept `view`/`defaultView`/`onViewChange` props (TypeScript error).

- [ ] **Step 3: Add the props to `CanvasProps`**

In `src/canvas/Canvas.tsx`, find `interface CanvasProps<...>` (around line 236). Add the import at the top of the file (with the other type imports):

```ts
import type { View } from '../features/viewport/view';
```

Inside `CanvasProps`, add (e.g. just before the `helpersRef?` field):

```ts
  /** Controlled viewport. When supplied, Canvas does not own the value —
   *  the consumer must supply `onViewChange` and re-render with the new
   *  view. See `View` JSDoc for the camera-position convention. */
  view?: View;
  /** Initial viewport for the uncontrolled path. Default `{x:0, y:0}`. */
  defaultView?: View;
  /** Fires whenever the viewport changes — in both controlled and
   *  uncontrolled modes. */
  onViewChange?: (next: View) => void;
```

- [ ] **Step 4: Destructure the new props**

In the `CanvasInner` function's destructure block (around line 586+), add the three new props (e.g. after `tools,`):

```ts
    view: viewProp,
    defaultView,
    onViewChange,
```

- [ ] **Step 5: Add internal viewport state + viewRef**

Just below the destructure (e.g. near where `canvasRef` is declared, before `synthesizedAdapter`), add:

```ts
  // Viewport state: hybrid uncontrolled/controlled. When `viewProp` is
  // supplied we are controlled (consumer owns state). Otherwise we keep
  // internal state seeded from `defaultView`. `setView` always fires
  // `onViewChange` so consumers can persist regardless of mode.
  const [internalView, setInternalView] = useState<View>(defaultView ?? { x: 0, y: 0 });
  const effectiveView: View = viewProp ?? internalView;
  const viewRef = useRef<View>(effectiveView);
  viewRef.current = effectiveView;
  const onViewChangeRef = useRef(onViewChange);
  onViewChangeRef.current = onViewChange;
  const setView = useCallback((next: View) => {
    if (viewProp === undefined) setInternalView(next);
    onViewChangeRef.current?.(next);
  }, [viewProp]);
  const setViewRef = useRef(setView);
  setViewRef.current = setView;
```

- [ ] **Step 6: Project client→world inside `toolsCtxBase`; expose view + setView**

Find `toolsCtxBase` (around line 722). Replace its body with:

```ts
  const toolsCtxBase = useMemo(
    () => (overrides?: { clientX?: number; clientY?: number }) => {
      const view = viewRef.current;
      let worldX = 0;
      let worldY = 0;
      if (overrides && (overrides.clientX !== undefined || overrides.clientY !== undefined)) {
        const c = canvasRef.current;
        if (c) {
          const rect = c.getBoundingClientRect();
          if (overrides.clientX !== undefined) worldX = (overrides.clientX - rect.left) + view.x;
          if (overrides.clientY !== undefined) worldY = (overrides.clientY - rect.top) + view.y;
        }
      }
      return {
        worldX,
        worldY,
        modifiers: { alt: false, shift: false, meta: false, ctrl: false, space: false },
        selection: effectiveSelectionRefForCtx.current,
        adapter: effectiveAdapterRefForCtx.current,
        applyBatch: (ops: Op[], label: string) => {
          const a = effectiveAdapterRefForCtx.current as { applyBatch?: (ops: Op[], label: string) => void };
          if (a.applyBatch) a.applyBatch(ops, label);
        },
        view,
        setView: setViewRef.current,
      };
    },
    [],
  );
```

(Modifiers are still hard-false in the base — the dispatcher's events carry them via the event object, and tools that need ambient modifier state read from the event directly. Phase 2c may revisit.)

- [ ] **Step 7: Pass view to runLayers**

In the render `useEffect` (around line 1336), change:

```ts
    runLayers(ctx, layers, helpersForLayers, {});
```

to:

```ts
    runLayers(ctx, layers, helpersForLayers, {}, undefined, effectiveView);
```

And update the effect's deps array to include `effectiveView`:

```ts
  }, [layers, width, height, background, effectiveView]);
```

- [ ] **Step 8: Run all Canvas + tools tests**

```
npm test -- src/canvas/Canvas.test.tsx src/tools/
```

Expected: PASS — the new viewport tests pass, all existing Canvas + tools tests still pass.

- [ ] **Step 9: Commit**

```bash
git add src/canvas/Canvas.tsx src/canvas/Canvas.test.tsx src/tools/useTools.ts
git commit -m "feat(canvas): viewport state + client→world projection + view in ToolCtx

Hybrid uncontrolled/controlled viewport: \`view\`/\`defaultView\`/\`onViewChange\`
on Canvas. \`runLayers\` is invoked with the current view so world layers
get translated; chrome can opt in to 'screen' later. Tools see live
view + setView via ToolCtx; pointer worldX/Y are projected from
clientX/Y through the current view."
```

---

## Task 7: `useHandTool`

**Files:**
- Create: `src/tools/builtin/useHandTool.ts`
- Test: `src/tools/builtin/useHandTool.test.ts`

A single Tool record registered in both slots — active (`H`) and modifier (`space`). Drag handlers compute pan deltas inline. No reuse of legacy `usePan`.

- [ ] **Step 1: Write the failing test**

`src/tools/builtin/useHandTool.test.ts`:

```ts
import { describe, it, expect, vi } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useHandTool } from './useHandTool';
import type { ToolCtx } from '../types';
import type { View } from '../../features/viewport/view';

function fakeEvent(clientX: number, clientY: number): PointerEvent {
  // jsdom doesn't implement PointerEvent constructor; fake it.
  const e = new Event('pointermove') as PointerEvent;
  Object.assign(e, { clientX, clientY });
  return e;
}

function makeCtx(view: View, setView: (v: View) => void): ToolCtx<unknown> {
  return {
    worldX: 0,
    worldY: 0,
    modifiers: { alt: false, shift: false, meta: false, ctrl: false, space: false },
    selection: {} as never,
    adapter: null,
    applyBatch: () => {},
    view,
    setView,
    scratch: undefined,
  };
}

describe('useHandTool', () => {
  it('declares H keybinding and space modifier trigger', () => {
    const { result } = renderHook(() => useHandTool());
    expect(result.current.id).toBe('hand');
    expect(result.current.keybinding).toBe('H');
    expect(result.current.modifier).toBe('space');
  });

  it('drag.onStart captures startView + start client coords; returns claim', () => {
    const { result } = renderHook(() => useHandTool());
    const tool = result.current;
    const setView = vi.fn();
    const ctx = makeCtx({ x: 30, y: 40 }, setView);
    const decision = tool.drag!.onStart!(fakeEvent(100, 200), ctx);
    expect(decision).toBe('claim');
    // scratch is held in ctx (caller may have replaced it); we verify next move
    // uses the captured startView + startClient.
    const moveDecision = tool.drag!.onMove!(fakeEvent(110, 215), ctx);
    expect(moveDecision).toBe('claim');
    // dx = 10, dy = 15 → new view = startView - delta = (30-10, 40-15)
    expect(setView).toHaveBeenCalledWith({ x: 20, y: 25 });
  });

  it('drag.onMove with no preceding onStart is a no-op pass', () => {
    const { result } = renderHook(() => useHandTool());
    const setView = vi.fn();
    const ctx = makeCtx({ x: 0, y: 0 }, setView);
    const decision = result.current.drag!.onMove!(fakeEvent(50, 50), ctx);
    // pass through — no scratch means no captured start, can't pan.
    expect(decision).toBe('pass');
    expect(setView).not.toHaveBeenCalled();
  });

  it('drag.onEnd clears scratch (next onMove is a no-op pass)', () => {
    const { result } = renderHook(() => useHandTool());
    const tool = result.current;
    const setView = vi.fn();
    const ctx = makeCtx({ x: 0, y: 0 }, setView);
    tool.drag!.onStart!(fakeEvent(0, 0), ctx);
    tool.drag!.onEnd!(fakeEvent(10, 10), ctx);
    setView.mockClear();
    const decision = tool.drag!.onMove!(fakeEvent(20, 20), ctx);
    expect(decision).toBe('pass');
    expect(setView).not.toHaveBeenCalled();
  });

  it('cursor is grab when idle, grabbing when scratch is non-null', () => {
    const { result } = renderHook(() => useHandTool());
    const tool = result.current;
    const setView = vi.fn();
    const ctx = makeCtx({ x: 0, y: 0 }, setView);
    expect(typeof tool.cursor).toBe('function');
    expect((tool.cursor as (ctx: ToolCtx) => string)(ctx)).toBe('grab');
    // After onStart, scratch is non-null on the ctx.
    tool.drag!.onStart!(fakeEvent(0, 0), ctx);
    expect((tool.cursor as (ctx: ToolCtx) => string)(ctx)).toBe('grabbing');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```
npm test -- src/tools/builtin/useHandTool.test.ts
```

Expected: FAIL — module not found.

- [ ] **Step 3: Write minimal implementation**

`src/tools/builtin/useHandTool.ts`:

```ts
import { useMemo } from 'react';
import { defineTool } from '../defineTool';
import type { Tool } from '../types';
import type { View } from '../../features/viewport/view';

interface HandScratch {
  startView: View;
  startClientX: number;
  startClientY: number;
}

/**
 * Pan-on-drag tool. Registered in both the active slot (sticky, `H` key)
 * and the modifier slot (momentary, hold `space`).
 *
 * Drag handlers compute pan deltas inline. View is read from ctx.view at
 * gesture start and written via ctx.setView on every move — so the tool
 * works with both controlled and uncontrolled Canvas viewport modes
 * without any extra wiring.
 *
 * Sign convention: dragging the mouse right moves the canvas content right
 * relative to the viewport — i.e. the camera moves *left*. So the new view
 * is `{ x: startView.x - dx, y: startView.y - dy }`.
 */
export function useHandTool(): Tool<HandScratch | null> {
  return useMemo(
    () =>
      defineTool<HandScratch | null>({
        id: 'hand',
        keybinding: 'H',
        modifier: 'space',
        initScratch: () => null,
        cursor: (ctx) => (ctx.scratch ? 'grabbing' : 'grab'),
        drag: {
          onStart: (e, ctx) => {
            ctx.scratch = {
              startView: ctx.view,
              startClientX: e.clientX,
              startClientY: e.clientY,
            };
            return 'claim';
          },
          onMove: (e, ctx) => {
            if (!ctx.scratch) return 'pass';
            const dx = e.clientX - ctx.scratch.startClientX;
            const dy = e.clientY - ctx.scratch.startClientY;
            ctx.setView({
              x: ctx.scratch.startView.x - dx,
              y: ctx.scratch.startView.y - dy,
            });
            return 'claim';
          },
          onEnd: (_e, ctx) => {
            ctx.scratch = null;
            return 'claim';
          },
          onCancel: (ctx) => {
            ctx.scratch = null;
          },
        },
      }),
    [],
  );
}
```

Note: tests mutate `ctx.scratch` directly (the test passes the same `ctx` to `onStart` then `onMove`). That matches how the dispatcher works: it captures `ctx.scratch` after each handler returns and re-injects it. The test mimics that contract.

- [ ] **Step 4: Run test to verify it passes**

```
npm test -- src/tools/builtin/useHandTool.test.ts
```

Expected: PASS — 5 passed.

- [ ] **Step 5: Commit**

```bash
git add src/tools/builtin/useHandTool.ts src/tools/builtin/useHandTool.test.ts
git commit -m "feat(tools): useHandTool — pan-on-drag, active+modifier slots

Single Tool record registered as 'hand': active slot via 'H' key, modifier
slot via 'space'. drag.onStart captures startView + start client coords;
drag.onMove computes deltas and calls ctx.setView with sign-flipped
camera-position math. cursor: 'grab' idle, 'grabbing' mid-drag."
```

---

## Task 8: Re-export `useHandTool` from builtin barrel

**Files:**
- Modify: `src/tools/builtin/index.ts`

- [ ] **Step 1: Add the export**

Append to `src/tools/builtin/index.ts`:

```ts
export { useHandTool } from './useHandTool';
```

- [ ] **Step 2: Verify the wider tools barrel re-exports it**

`src/tools/index.ts` already has `export * from './builtin';` — no change needed. Verify:

```
npm test -- src/tools/
```

Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add src/tools/builtin/index.ts
git commit -m "feat(tools): export useHandTool from builtin barrel"
```

---

## Task 9: Deprecate `usePan`

**Files:**
- Modify: `src/features/viewport/usePan.ts`

JSDoc only — no behavior change, no test change. Removal is deferred to Phase 2c when zoom lands and the bezier demo migrates.

- [ ] **Step 1: Add `@deprecated` to the function**

In `src/features/viewport/usePan.ts`, replace the existing JSDoc on the `usePan` function (lines 10-15) with:

```ts
/**
 * Pan-on-drag interaction. The caller supplies `getActive`, which is read
 * at pan-start so the appropriate viewport is captured for the duration of
 * the gesture (useful when the app has multiple viewports — e.g. a main
 * canvas plus a separate seed-starting view).
 *
 * @deprecated Phase 2b ships `useHandTool` from `@orochi235/weasel/tools`
 * which integrates with `<Canvas view={...} />`. This hook uses
 * `React.MouseEvent` and an inverted (additive) sign convention — incompatible
 * with the Tool primitive dispatcher and the new `View` shape. Removal is
 * scheduled for Phase 2c once consumers (currently only the bezier-zoom doc
 * reference) have migrated.
 */
```

- [ ] **Step 2: Verify no behavior change**

```
npm test -- src/features/viewport/usePan.test.ts
```

Expected: PASS — JSDoc-only change.

- [ ] **Step 3: Commit**

```bash
git add src/features/viewport/usePan.ts
git commit -m "docs(viewport): deprecate usePan in favor of useHandTool

Phase 2b ships useHandTool wired through <Canvas view={...}>. The
legacy usePan uses MouseEvent + additive sign convention — incompatible
with the Tool dispatcher. Physical removal deferred to Phase 2c."
```

---

## Task 10: Pan demo

**Files:**
- Create: `demo/demos/PanDemo.tsx`
- Modify: `demo/CanvasKitDemo.tsx`

A minimal demo wiring `useHandTool` + `useTools` + `useKeybindings` + `<Canvas>` viewport props. Uses the inline-items path with three rectangles spread across a coordinate range bigger than the viewport, so panning visibly reveals/hides them.

- [ ] **Step 1: Inspect the demo router conventions**

```
grep -n "PixelDensityDemo\|InsertDemo" demo/CanvasKitDemo.tsx | head -10
```

Read enough of `demo/CanvasKitDemo.tsx` (likely the imports + a routing array) to understand the pattern. Read a small existing demo (e.g. `demo/demos/InsertDemo.tsx`) to see how `<Canvas>` is wired with `items`/`setItems`.

- [ ] **Step 2: Write the demo**

`demo/demos/PanDemo.tsx`:

```tsx
import { useState } from 'react';
import { Canvas, useTools, useKeybindings, useHandTool, useSelectTool } from '../../src';
import type { View } from '../../src/features/viewport/view';

interface Rect { id: string; x: number; y: number; width: number; height: number; color: string }

const INITIAL_ITEMS: Rect[] = [
  { id: 'a', x:  50, y:  50, width: 80, height: 60, color: '#7fb069' },
  { id: 'b', x: 300, y: 200, width: 80, height: 60, color: '#a48bd4' },
  { id: 'c', x: 600, y: 400, width: 80, height: 60, color: '#f0e0a8' },
];

export function PanDemo() {
  const [items, setItems] = useState<Rect[]>(INITIAL_ITEMS);
  const [view, setView] = useState<View>({ x: 0, y: 0 });

  // We only need select + hand for this demo.
  const select = useSelectTool({
    getSelection: () => [],
    setSelection: () => {},
    getPose: (id) => items.find((r) => r.id === id) ?? null,
    getObjects: () => items,
    setPose: (id, pose) => setItems((cur) => cur.map((r) => r.id === id ? { ...r, ...(pose as Rect) } : r)),
    applyBatch: () => {},
  });
  const hand = useHandTool();

  const tools = useTools({
    active: 'select',
    registry: { select, hand },
  });
  useKeybindings(tools);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
        <span style={{ fontFamily: 'monospace' }}>tool: {tools.modifierEngaged ?? tools.active}</span>
        <span style={{ fontFamily: 'monospace' }}>view: ({view.x.toFixed(0)}, {view.y.toFixed(0)})</span>
        <button onClick={() => setView({ x: 0, y: 0 })}>Reset view</button>
        <span style={{ color: '#888' }}>H = hand · space (hold) = momentary hand</span>
      </div>
      <Canvas
        width={400}
        height={300}
        items={items}
        setItems={setItems}
        view={view}
        onViewChange={setView}
        tools={tools}
        background="#1a130d"
        layers={{
          scene: {
            drawOne: (ctx, _obj, pose) => {
              const r = pose as Rect;
              ctx.fillStyle = r.color;
              ctx.fillRect(r.x, r.y, r.width, r.height);
            },
          },
        }}
      />
    </div>
  );
}
```

(The demo is small on purpose — it proves the wiring without becoming a tutorial.)

- [ ] **Step 3: Register the demo in the router**

Open `demo/CanvasKitDemo.tsx`. Add the import alongside the others:

```ts
import { PanDemo } from './demos/PanDemo';
```

Add a row to whichever array/object holds the demos (mirroring the surrounding entries — name + component). Example shape (verify against the actual file):

```ts
{ name: 'Pan (Phase 2b)', Component: PanDemo },
```

- [ ] **Step 4: Verify build**

```
npm test -- src/
```

Expected: PASS — no test changes; just a lint/typecheck guard that the demo builds.

```
npm run build 2>&1 | tail -20
```

Expected: build succeeds; no demo-related TS errors.

- [ ] **Step 5: Commit**

```bash
git add demo/demos/PanDemo.tsx demo/CanvasKitDemo.tsx
git commit -m "demo: PanDemo — useHandTool + Canvas view props (Phase 2b)

Three rectangles spread across a coordinate range bigger than the 400x300
viewport. Demonstrates: H to switch to hand tool, space to engage
momentary hand, drag to pan, Reset view button. Select tool stays
available when neither hand activation is engaged."
```

---

## Task 11: Integration smoke test

**Files:**
- Modify: `src/tools/builtin/integration.test.tsx`

Two new tests, exercising the full Canvas → dispatcher → useHandTool → ctx.setView → Canvas re-render cycle. Reuses the jsdom canvas stubs already established in this file.

- [ ] **Step 1: Add the failing tests**

Append to `src/tools/builtin/integration.test.tsx`:

```ts
import { useHandTool } from './useHandTool';

describe('Phase 2b end-to-end: hand tool + Canvas viewport', () => {
  it('H switches active to hand; drag pans; view updates', async () => {
    const onViewChange = vi.fn();

    function Harness() {
      const [view, setView] = useState({ x: 0, y: 0 });
      const select = useSelectTool({
        getSelection: () => [],
        setSelection: () => {},
        getPose: () => null,
        getObjects: () => [],
        setPose: () => {},
        applyBatch: () => {},
      });
      const hand = useHandTool();
      const tools = useTools({ active: 'select', registry: { select, hand } });
      useKeybindings(tools);
      return (
        <Canvas
          width={200}
          height={200}
          items={[]}
          setItems={() => {}}
          view={view}
          onViewChange={(v) => { setView(v); onViewChange(v); }}
          tools={tools}
          layers={{ scene: { drawOne: () => {} } }}
        />
      );
    }

    const { container } = render(<Harness />);
    const canvas = container.querySelector('canvas')!;

    // Switch to hand via the H key.
    fireEvent.keyDown(document, { key: 'H' });

    // Pointer down + move past 4px threshold + up.
    fireEvent.pointerDown(canvas, { clientX: 100, clientY: 100 });
    fireEvent.pointerMove(canvas, { clientX: 150, clientY: 130 });
    fireEvent.pointerUp(canvas, { clientX: 150, clientY: 130 });

    // dx=50, dy=30 → view = (0-50, 0-30) = (-50, -30)
    expect(onViewChange).toHaveBeenCalledWith({ x: -50, y: -30 });
  });

  it('space engages momentary hand; release returns to prior tool', () => {
    const onViewChange = vi.fn();

    function Harness() {
      const [view, setView] = useState({ x: 0, y: 0 });
      const select = useSelectTool({
        getSelection: () => [],
        setSelection: () => {},
        getPose: () => null,
        getObjects: () => [],
        setPose: () => {},
        applyBatch: () => {},
      });
      const hand = useHandTool();
      const tools = useTools({ active: 'select', registry: { select, hand } });
      useKeybindings(tools);
      // Surface tools.modifierEngaged for the assertion.
      (window as unknown as { __tools: typeof tools }).__tools = tools;
      return (
        <Canvas
          width={200}
          height={200}
          items={[]}
          setItems={() => {}}
          view={view}
          onViewChange={(v) => { setView(v); onViewChange(v); }}
          tools={tools}
          layers={{ scene: { drawOne: () => {} } }}
        />
      );
    }

    render(<Harness />);
    const tools = (window as unknown as { __tools: { modifierEngaged: string | null } }).__tools;

    fireEvent.keyDown(document, { key: ' ' });
    expect(tools.modifierEngaged).toBe('hand');

    fireEvent.keyUp(document, { key: ' ' });
    // After re-render, the latest tools snapshot has modifierEngaged === null.
    // We re-read via the global since React's useState updater may have re-rendered.
    const fresh = (window as unknown as { __tools: { modifierEngaged: string | null } }).__tools;
    expect(fresh.modifierEngaged).toBeNull();
  });
});
```

(The harness pattern mirrors the existing Phase 2a integration tests in this file; reuse the shared `beforeAll` canvas stubs at the top.)

- [ ] **Step 2: Run failing tests**

```
npm test -- src/tools/builtin/integration.test.tsx
```

Expected: FAIL — fresh tests not yet wired through the production Canvas/tools paths.

- [ ] **Step 3: Triage and fix**

If failures are due to the test setup (e.g. ctx stubs missing a method), mirror the existing Phase 2a pattern. If failures are real bugs (e.g. view doesn't propagate), fix in the relevant prior task and commit a follow-up. Common gotchas:

- `useKeybindings` ignores keys when `isEditableTarget(e.target)` — `document` body is not editable, so this should pass.
- Pointer event must fire on the canvas element (not document).
- The dispatcher requires the threshold (4px) to be crossed before `drag.onStart` fires — the test uses dx=50 to be safely past it.

- [ ] **Step 4: Run all tests**

```
npm test
```

Expected: PASS — full suite green (852+ existing passes plus the new Phase 2b tests).

- [ ] **Step 5: Commit**

```bash
git add src/tools/builtin/integration.test.tsx
git commit -m "test(tools): Phase 2b integration — hand tool active + modifier engagement

Covers H switches to hand + drag pans + onViewChange fires with the
expected camera-position delta; space engages modifier momentarily and
release returns to the prior active tool."
```

---

## Self-Review

**1. Spec coverage:**

| Spec section | Task |
| --- | --- |
| `View = {x, y}` camera-position convention | Task 1 |
| `viewToTransform` adapter for chrome | Task 1 |
| Canvas hybrid uncontrolled/controlled `view`/`defaultView`/`onViewChange` | Task 6 |
| `RenderLayer.space` + `runLayers` translation | Task 2 |
| Pointer→world via `screenToWorld` | Task 6 (inline projection in `toolsCtxBase`) |
| `ToolCtx.view` + `ToolCtx.setView` | Tasks 3, 5, 6 |
| `useHandTool` (active + modifier slots, drag math, cursor) | Task 7 |
| Deprecate `usePan` (keep, mark @deprecated) | Task 9 |
| Unit tests (pan math, controlled vs uncontrolled, screen→world) | Tasks 1, 2, 6, 7 |
| Integration tests (active H, modifier space, select coexistence) | Task 11 |
| Demo replacing pan workaround | Task 10 |
| Out-of-scope deferrals (zoom, hitRadius semantics, drawOne signature, pan bounds, momentum, Cmd+0, usePan removal) | Documented in spec — no tasks needed |

**Spec deviation noted explicitly:** The spec also enumerates kit-built chrome factories that should opt in to `space: 'screen'` (selection overlay, marquee, area-select, corner handles, rotation handle). Under pan-only (scale=1), `'screen'` and `'world'` produce visually identical pixels — the chrome opt-in only matters once zoom lands. Since (a) every chrome factory would need a `getView` plumbing addition, (b) the visible pixels wouldn't change, and (c) the `space` field plus `runLayers` honoring it is wired and tested in Task 2 — the chrome flip is deferred to Phase 2c where it actually has user-visible impact. The infrastructure is in place; the consumers move when they need to.

**2. Placeholder scan:** No "TBD/TODO/implement later", no "add appropriate error handling", no "similar to Task N" without inline code. Every step that changes code shows the code. Every command shows the expected outcome.

**3. Type consistency:**

- `View` shape (`{x, y}`) is identical across Tasks 1, 3, 6, 7.
- `viewToTransform(view: View): ViewTransform` signature stable from Task 1; only Task 1 implements, no other task imports it (kit chrome flip deferred to Phase 2c).
- `ToolCtx.view`/`setView` field names match across types.ts (Task 3), useTools DEFAULT_CTX (Task 5), Canvas toolsCtxBase (Task 6), and useHandTool consumption (Task 7).
- `runLayers` 6-arg signature `(ctx, layers, data, visibility, order?, view?)` — order matters because Canvas's call site (Task 6) passes `undefined` for `order` then `effectiveView`. Verified: Task 2 implementation matches Task 6 call site.
- Dispatcher override field rename `worldX/worldY` → `clientX/clientY` (Task 4) is consumed in Task 5 (useTools getCtx) and Task 6 (Canvas toolsCtxBase). All three task code blocks use the same names.
- `useHandTool`'s `Tool<HandScratch | null>` matches the `defineTool<HandScratch | null>(...)` call.
- `Canvas` `view`/`defaultView`/`onViewChange` prop names match across the props interface (Task 6 step 3), the destructure (Task 6 step 4), the test harness (Task 6 step 1, Task 10, Task 11), and the JSDoc for `defaultView` (default `{x:0,y:0}`).

No inconsistencies found.

---

## Execution Handoff

Plan complete and saved to `docs/plans/2026-05-03-tool-primitive-phase-2b.md`. Two execution options:

**1. Subagent-Driven (recommended)** — I dispatch a fresh subagent per task, review between tasks, fast iteration

**2. Inline Execution** — Execute tasks in this session using executing-plans, batch execution with checkpoints

Which approach?
