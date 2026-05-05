# Canvas Inline-Gesture Cleanup Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Finish the Tool overlay channel migration by retiring the legacy `usePointerGestures` fallback path inside `Canvas.tsx`, dropping `buildSceneLayer`'s tool-overlay fold-in, refreshing stale demo source-string templates, and rewriting the Canvas tests that exercise the legacy path. After this lands, `<Canvas>` only routes pointer events through `tools.dispatcher`; demos drive everything via `useSelectTool` (or a peer Tool hook) and `useTools`.

**Architecture:** All seven demos in scope already render through a `tools={...}` prop in their live code — the residual cleanup is in their `*_DEMO_SOURCE` template strings (still showing the pre-Tool API) and in Canvas's own dual-path internals. `Canvas.tsx` keeps its `pickEvery` / `boundsOf` / `geometry` props because the **selection-overlay** layer still consumes them for handle hit-tests, but the legacy `onBodyHit` / `onTapEmpty` / `handleHitRadius` / `resizeTarget` / `rotateTarget` props and the entire `usePointerGestures` branch in `handlePointerDown/Move/Up` are deleted. `buildSceneLayer` stops folding the active tool's `peekPose` / `peekHide` into scene drawing — tools that need a ghost should publish overlay layers via `tools.getActiveOverlays()` (already wired into the layer pipeline).

**Tech Stack:** React 18 + TypeScript, Vitest + React Testing Library. Reference patterns:
- `demo/demos/SwillustratorDemo.tsx` — canonical `useSelectTool` integration.
- `src/tools/builtin/useSelectTool.ts` — `UseSelectToolOptions` surface (`pickEvery`, `boundsOf`, `move`, `resize`, `rotate`, `areaSelect`, `drawGhost`, `getObject`).
- `src/canvas/SceneCanvas.tsx` — synthesizes `useSelectTool` + `useTools` internally for scene-driven demos (already used by MoveDemo, TextDemo).

---

## Status snapshot (2026-05-05)

The seven demos and Canvas internals all show partial migration already:

| Surface | Live code | Source-string template | Notes |
|---|---|---|---|
| `MoveDemo.tsx` | ✅ SceneCanvas | ✅ matches | done |
| `ActionsDemo.tsx` | ✅ `useSelectTool` + tools | ✅ matches | done |
| `GroupsDemo.tsx` | ✅ `useSelectTool` + tools | ❌ shows `moveOptions` / `resizeOptions` | stale string |
| `CloneDemo.tsx` | ✅ `useCloneTool` + tools | ✅ matches | done |
| `BezierEditDemo.tsx` | ✅ `useSelectWithAnchorEdit` + tools | ✅ matches | done |
| `PathPoseDemo.tsx` | ✅ `useSelectTool` + tools | ❌ comment references `moveOptions.translatePose` / `resizeOptions.geometry` | stale comment |
| `TextDemo.tsx` | ✅ SceneCanvas | ✅ matches | done |
| `Canvas.tsx` | ❌ keeps `usePointerGestures` fallback + `buildSceneLayer` overlay fold-in + legacy props | n/a | strip target |
| `Canvas.test.tsx` | ❌ three tests exercise the legacy path | n/a | rewrite target |

**Live-code task scope is therefore: stale strings (Tasks 1–2), test rewrite (Task 3), Canvas strip (Tasks 4–6).** No demo refactor is needed beyond the templates.

---

## File map

**Modify (source-string template refresh):**
- `demo/demos/GroupsDemo.tsx` — update `GROUPS_DEMO_SOURCE` string to show `useSelectTool({ move: { expandIds }, resize: { expandIds } })` instead of `moveOptions={...}` / `resizeOptions={...}`.
- `demo/demos/PathPoseDemo.tsx` — update inline comment referencing `moveOptions.translatePose` / `resizeOptions.geometry` to point at `useSelectTool` `move` / `resize` / `geometry` options.

**Modify (test rewrite):**
- `src/canvas/Canvas.test.tsx`:
  - Rewrite `'auto-build pointer handler routes through usePointerGestures'` (~line 95) to drive a `useSelectTool`-backed tools setup and assert `selection.applyClick` fires on body hit.
  - Rewrite `'integrates with useSelection (smoke)'` (~line 121) to use `tools={useTools(...)}` instead of bare `pickEvery` + `selection`.
  - Delete `'legacy hook-prop wiring still works when tools prop is omitted'` (~line 532).

**Modify (Canvas strip):**
- `src/canvas/Canvas.tsx`:
  - Drop the no-tools branch from `handlePointerDown` / `handlePointerMove` / `handlePointerUp` (~lines 987–1014). When `tools` is undefined the canvas becomes a passive renderer (selection overlay still hit-tests its own handles via `selectionOverlay`'s pointer config).
  - Drop the entire `usePointerGestures` call site and supporting closures: `effectiveHitBody`, `effectiveResizeTarget`, `effectiveOnBodyHit`, `unionOfSelection`, `multiActive`, `MULTI_RESIZE_TARGET_ID` (~lines 755–907 — keep `effectiveBoundsOf` and `baseHitBody` because the selection-overlay layer still queries them).
  - Strip `buildSceneLayer`'s `peekPose` / `peekHide` parameters and overlay fold-in (~lines 367–402, 1042–1049). Scene drawing reads committed adapter pose only; tools publish ghosts via `tools.getActiveOverlays()`.
  - Drop legacy props from `CanvasProps`: `onBodyHit`, `onTapEmpty`, `handleHitRadius`, `resizeTarget`, `rotateTarget`, `rotationHandleDistance`. Keep `pickEvery`, `boundsOf`, `geometry`, `clientToWorld` (still consumed by selection-overlay handle hit-test and tools).
  - Drop the multi-mode selection-overlay multi-union branch from the `poseById` resolver (~lines 1064–1067) — multi-resize is the active tool's concern; the resizeTool can publish a `peekBounds(MULTI_RESIZE_TARGET_ID)` overlay if needed (out of scope for this plan; tracked in TODO).

**Modify:**
- `docs/TODO.md` — add a follow-up entry for resizeTool publishing the multi-union peekBounds (deferred from Task 6).

**Tests:** `src/canvas/Canvas.test.tsx` is rewritten in Task 3. The `useSelectTool body/handle routing` describe block (lines 142–306) already drives the tools path and stays as-is. Demo integration tests under `demo/demos/__tests__/` are not added — the existing per-demo tests (the ones that already exist) plus the rewritten Canvas tests cover this surface.

---

## Task ordering rationale

Cheapest tasks first to keep the build green incrementally:
1. Stale source-string fixes (Tasks 1–2) — pure string edits, no behavior.
2. Test rewrite (Task 3) — pre-positions the suite for the strip without changing Canvas behavior.
3. Canvas strip in three steps: Canvas pointer-handler dual-path collapse (Task 4), `buildSceneLayer` overlay fold-in (Task 5), legacy props (Task 6).

Each task is independently committable; the build is green between every commit.

---

## Task 1: Refresh `GROUPS_DEMO_SOURCE` template

**Files:**
- Modify: `demo/demos/GroupsDemo.tsx`

- [ ] **Step 1: Locate the stale source-string block**

In `demo/demos/GroupsDemo.tsx`, find `GROUPS_DEMO_SOURCE` (the exported template literal). The body currently shows the pre-Tool API:

```tsx
<Canvas
  adapter={adapter}
  selection={selection}
  moveOptions={{ expandIds: (ids) => expandToLeaves(ids, adapter) }}
  resizeOptions={{ expandIds: (ids) => /* leaf-or-group */ }}
  layers={{ scene: { drawOne } }}
/>
```

- [ ] **Step 2: Rewrite the template body to match live code**

Replace that block with:

```tsx
const select = useSelectTool<Rect, Pose>(adapter, {
  pickEvery: (wx, wy) => /* group-aware hit-test */,
  boundsOf: (id) => /* group-aware bounds */,
  move:   { expandIds: (ids) => expandToLeaves(ids, adapter) },
  resize: { expandIds: (ids) => /* leaf-or-group */ },
  drawGhost: (cx, _o, p) => { cx.fillRect(p.x, p.y, p.width, p.height); },
  getObject: (id) => adapter.getObject(id) ?? null,
});
const tools = useTools({ active: 'select', registry: { select } });

return (
  <Canvas
    adapter={adapter}
    selection={selection}
    tools={tools}
    layers={{ scene: { drawOne } }}
  />
);
```

(Keep the surrounding prose comments in the template that describe what the demo demonstrates — only the JSX body changes.)

- [ ] **Step 3: Build to confirm the demo still compiles**

Run: `pnpm typecheck`
Expected: PASS — the source string is just a literal, but adjacent imports (`useTools`, `useSelectTool`) must already be in scope from the live demo (they are).

- [ ] **Step 4: Commit**

```bash
git add demo/demos/GroupsDemo.tsx
git commit -m "docs(demo): refresh GROUPS_DEMO_SOURCE to match live useSelectTool wiring"
```

---

## Task 2: Refresh `PathPoseDemo` stale comment

**Files:**
- Modify: `demo/demos/PathPoseDemo.tsx`

- [ ] **Step 1: Locate the stale comment**

In `demo/demos/PathPoseDemo.tsx` around lines 130–133:

```tsx
// pose.kind, so pickEvery / boundsOf / moveOptions.translatePose /
// resizeOptions.geometry all know about Paths without an explicit prop.
```

- [ ] **Step 2: Rewrite to current API**

Replace with:

```tsx
// pose.kind, so pickEvery / boundsOf / move.translatePose /
// resize.geometry all know about Paths without an explicit prop.
```

(The options moved from top-level Canvas props to nested options on `useSelectTool`; the `pathPoseDescriptor` is supplied via the tool's `geometry` option.)

- [ ] **Step 3: Run typecheck**

Run: `pnpm typecheck`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add demo/demos/PathPoseDemo.tsx
git commit -m "docs(demo): correct stale moveOptions/resizeOptions comment in PathPoseDemo"
```

---

## Task 3: Rewrite Canvas legacy-path tests onto `useSelectTool`

**Files:**
- Modify: `src/canvas/Canvas.test.tsx`

The test suite has three legacy-path cases that drive `usePointerGestures` directly. They must be rewritten before the strip lands so the suite stays green at every commit.

- [ ] **Step 1: Replace the `usePointerGestures` body-hit smoke test**

In `src/canvas/Canvas.test.tsx` find:

```tsx
it('auto-build pointer handler routes through usePointerGestures', () => {
  const onBodyHit = vi.fn();
  const { container } = render(
    <Canvas
      width={50}
      height={50}
      layers={{}}
      pickEvery={() => 'a'}
      onBodyHit={onBodyHit}
    />,
  );
  const canvas = container.querySelector('canvas')!;
  canvas.setPointerCapture = vi.fn();
  fireEvent.pointerDown(canvas, { clientX: 5, clientY: 5 });
  expect(onBodyHit).toHaveBeenCalledTimes(1);
});
```

Replace it with:

```tsx
it('auto-build pointer handler routes through tools.dispatcher', () => {
  interface Rect { id: string; x: number; y: number; width: number; height: number }
  interface Pose { x: number; y: number; width: number; height: number }
  const seen: string[][] = [];
  function Harness() {
    const sel = useSelection({ mode: 'multi' });
    sel.adapterMethods.applyClick = vi.fn((id: string) => seen.push([id]));
    const adapter = {
      getObjects: () => [{ id: 'a', x: 0, y: 0, width: 50, height: 50 }] as Rect[],
      getObject: (id: string) => (id === 'a'
        ? { id: 'a', x: 0, y: 0, width: 50, height: 50 } as Rect
        : null),
      getPose: (id: string) => (id === 'a' ? { x: 0, y: 0, width: 50, height: 50 } : null) as Pose,
      setPose: () => {},
      ...sel.adapterMethods,
    };
    const select = useSelectTool<Rect, Pose>(adapter, {
      pickEvery: () => ['a'],
      boundsOf: () => ({ x: 0, y: 0, width: 50, height: 50 }),
      drawGhost: () => {},
      getObject: (id) => adapter.getObject(id),
    });
    const tools = useTools({ active: 'select', registry: { select } });
    return <Canvas width={50} height={50} layers={{}} adapter={adapter} tools={tools} clientToWorld={() => [5, 5]} />;
  }
  const { container } = render(<Harness />);
  const canvas = container.querySelector('canvas')!;
  canvas.setPointerCapture = vi.fn();
  fireEvent.pointerDown(canvas, { clientX: 5, clientY: 5 });
  expect(seen).toEqual([['a']]);
});
```

- [ ] **Step 2: Replace the `useSelection (smoke)` test**

Find:

```tsx
it('integrates with useSelection (smoke)', () => {
  function TestHarness() {
    const sel = useSelection({ mode: 'multi' });
    return (
      <Canvas
        width={50}
        height={50}
        layers={{}}
        pickEvery={() => 'a'}
        selection={sel}
      />
    );
  }
  ...
});
```

Replace with:

```tsx
it('integrates with useSelection through useSelectTool (smoke)', () => {
  interface Rect { id: string; x: number; y: number; width: number; height: number }
  interface Pose { x: number; y: number; width: number; height: number }
  function TestHarness() {
    const sel = useSelection({ mode: 'multi' });
    const adapter = {
      getObjects: () => [] as Rect[],
      getObject: () => null,
      getPose: () => ({ x: 0, y: 0, width: 0, height: 0 }) as Pose,
      setPose: () => {},
      ...sel.adapterMethods,
    };
    const select = useSelectTool<Rect, Pose>(adapter, {
      pickEvery: () => ['a'],
      boundsOf: () => ({ x: 0, y: 0, width: 50, height: 50 }),
      drawGhost: () => {},
      getObject: () => null,
    });
    const tools = useTools({ active: 'select', registry: { select } });
    return <Canvas width={50} height={50} layers={{}} adapter={adapter} selection={sel} tools={tools} />;
  }
  const { container } = render(<TestHarness />);
  const canvas = container.querySelector('canvas')!;
  canvas.setPointerCapture = vi.fn();
  fireEvent.pointerDown(canvas, { clientX: 5, clientY: 5 });
  expect(canvas).toBeInstanceOf(HTMLCanvasElement);
});
```

- [ ] **Step 3: Delete the legacy-hook-prop smoke test**

Find and remove the entire test:

```tsx
it('legacy hook-prop wiring still works when tools prop is omitted', () => {
  ...
});
```

(The expected behavior — Canvas being usable without `tools` — collapses with Task 4. The remaining tests already exercise the no-tools "passive renderer" surface that survives.)

- [ ] **Step 4: Confirm imports cover the new code**

At the top of `Canvas.test.tsx`, ensure these are imported (add any missing):

```tsx
import { useSelection } from '../selection/useSelection';
import { useSelectTool } from '../tools/builtin/useSelectTool';
import { useTools } from '../tools/useTools';
```

- [ ] **Step 5: Run the suite**

Run: `pnpm test --run src/canvas/Canvas.test.tsx`
Expected: PASS — including all rewritten cases. Total cases: same minus 1 (`legacy hook-prop wiring`).

- [ ] **Step 6: Run the full suite to catch any other regressions**

Run: `pnpm test --run`
Expected: All previously-passing tests still pass.

- [ ] **Step 7: Commit**

```bash
git add src/canvas/Canvas.test.tsx
git commit -m "test(Canvas): migrate body/handle-drag tests onto useSelectTool"
```

---

## Task 4: Drop the no-tools pointer-handler branch in Canvas.tsx

**Files:**
- Modify: `src/canvas/Canvas.tsx`

After this task, `<Canvas>` without a `tools` prop renders chrome but ignores pointer events (selection-overlay layer still draws and can opt into its own pointer routing for handles, which is unchanged).

- [ ] **Step 1: Collapse `handlePointerDown` to the tools-only branch**

In `src/canvas/Canvas.tsx` find (approximately lines 987–1000):

```tsx
const handlePointerDown =
  onPointerDownOverride ??
  (tools
    ? (e: React.PointerEvent<HTMLCanvasElement>) => {
        if (autoFocusOnPointerDown) e.currentTarget.focus();
        tools.dispatcher.onPointerDown(e.nativeEvent);
        if (tools.dispatcher.hasActiveGesture()) attachDocListeners(tools.dispatcher);
      }
    : (e: React.PointerEvent<HTMLCanvasElement>) => {
        if (autoFocusOnPointerDown) e.currentTarget.focus();
        bindings.onPointerDown(e);
      });
```

Replace with:

```tsx
const handlePointerDown =
  onPointerDownOverride ??
  (tools
    ? (e: React.PointerEvent<HTMLCanvasElement>) => {
        if (autoFocusOnPointerDown) e.currentTarget.focus();
        tools.dispatcher.onPointerDown(e.nativeEvent);
        if (tools.dispatcher.hasActiveGesture()) attachDocListeners(tools.dispatcher);
      }
    : undefined);
```

- [ ] **Step 2: Collapse `handlePointerMove` / `handlePointerUp` / `handlePointerCancel` similarly**

Replace:

```tsx
const handlePointerMove = onPointerMoveOverride ??
  (tools
    ? (e: React.PointerEvent<HTMLCanvasElement>) => tools.dispatcher.onPointerMove(e.nativeEvent)
    : bindings.onPointerMove);
const handlePointerUp = onPointerUpOverride ??
  (tools
    ? (e: React.PointerEvent<HTMLCanvasElement>) => {
        tools.dispatcher.onPointerUp(e.nativeEvent);
        detachDocListeners();
      }
    : bindings.onPointerUp);
const handlePointerCancel = onPointerCancelOverride ?? bindings.onPointerCancel;
```

With:

```tsx
const handlePointerMove = onPointerMoveOverride ??
  (tools
    ? (e: React.PointerEvent<HTMLCanvasElement>) => tools.dispatcher.onPointerMove(e.nativeEvent)
    : undefined);
const handlePointerUp = onPointerUpOverride ??
  (tools
    ? (e: React.PointerEvent<HTMLCanvasElement>) => {
        tools.dispatcher.onPointerUp(e.nativeEvent);
        detachDocListeners();
      }
    : undefined);
const handlePointerCancel = onPointerCancelOverride ?? undefined;
```

- [ ] **Step 3: Remove the `usePointerGestures` call and its supporting closures**

Find the block at approximately lines 894–907:

```tsx
const bindings = usePointerGestures<TPose, TPose>({
  pickEvery: effectiveHitBody,
  resizeTarget: effectiveResizeTarget ?? resizeTarget,
  rotateTarget,
  rotationHandleDistance,
  selection: selectionMode === 'none' ? undefined : effectiveSelection,
  boundsOf: effectiveBoundsOf,
  onBodyHit: effectiveOnBodyHit ?? onBodyHit,
  onTapEmpty,
  clientToWorld,
  handleHitRadius,
  getView: () => viewRef.current,
  debug: debugSink ?? undefined,
});
```

Delete the entire `bindings = usePointerGestures(...)` call. The `usePointerGestures` import (~line 30–34 area) and any unused-after-deletion local helpers go too:
- Delete `effectiveHitBody` (~lines 838–861).
- Delete `effectiveResizeTarget` (~lines 867–874).
- Delete `effectiveOnBodyHit` (~lines 879–892).
- Delete `unionOfSelection` (~lines 758–776) **only if** no other code still uses it. It is still consumed by the selection-overlay multi-union poseById fallback (`~lines 1064–1067`); leave it for now and revisit in Task 6.

Keep `baseHitBody` and `effectiveBoundsOf` — the selection-overlay layer still resolves handle bounds through them.

- [ ] **Step 4: Remove the `usePointerGestures` import**

At the top of `Canvas.tsx`, find and remove the import line for `usePointerGestures` (and any sibling type imports it carries that are no longer used: `PointerGestureCallbackCtx` is still used by `effectiveOnBodyHit`'s type signature on the `CanvasProps` interface — that prop survives until Task 6, so keep the type until then).

Run: `pnpm typecheck`
Expected: PASS, or at most surface unused-import errors in this file. Fix them inline by deleting the unused imports. **Do NOT** silence with `_` renames — the imports are dead.

- [ ] **Step 5: Run the test suite**

Run: `pnpm test --run`
Expected: All tests pass. The rewritten tests from Task 3 already exercise the tools path; the surviving tests do not depend on `bindings`.

- [ ] **Step 6: Commit**

```bash
git add src/canvas/Canvas.tsx
git commit -m "refactor(Canvas): drop usePointerGestures fallback path; tools-only routing"
```

---

## Task 5: Drop `buildSceneLayer`'s tool-overlay fold-in

**Files:**
- Modify: `src/canvas/Canvas.tsx`

`buildSceneLayer` currently asks the active tool for `peekPose` / `peekHide` so scene drawing reflects in-flight ghosts. The Tool overlay channel (`tools.getActiveOverlays()`) already publishes a dedicated overlay layer that the layer pipeline appends — there's no second-source need. After this task, scene drawing reads committed adapter pose only; tools that show ghosts publish an overlay through their `overlay` field on the Tool record.

- [ ] **Step 1: Strip `peekPose` / `peekHide` from the `buildSceneLayer` signature**

Find (approximately lines 367–402):

```tsx
function buildSceneLayer<TObject extends { id: string }, TPose>(
  cfg: SceneSlotConfig<TObject, TPose>,
  adapter: ...,
  debugSink: DebugSink | null,
  boundsOfFn: ((id: string) => Bounds | null) | undefined,
  peekPose: ((id: string) => TPose | null) | null,
  peekHide: (() => Iterable<string> | null) | null,
): RenderLayer<unknown> {
  ...
  draw: (ctx, _data, view) => {
    const objects = cfg.objects ?? adapter?.getObjects() ?? [];
    const hideIter = peekHide?.() ?? null;
    const hide = hideIter ? new Set(hideIter) : null;
    for (const obj of objects) {
      const overlayPose = peekPose ? peekPose(obj.id) : null;
      if (hide && hide.has(obj.id) && overlayPose == null) continue;
      const pose: TPose = overlayPose ?? toPose(obj);
      ...
    }
  },
}
```

Replace with:

```tsx
function buildSceneLayer<TObject extends { id: string }, TPose>(
  cfg: SceneSlotConfig<TObject, TPose>,
  adapter:
    | (MoveAdapter<TObject, TPose> & ResizeAdapter<TObject, TPose> & RotateAdapter<TObject, TPose>)
    | undefined,
  debugSink: DebugSink | null,
  boundsOfFn: ((id: string) => Bounds | null) | undefined,
): RenderLayer<unknown> {
  const toPose =
    cfg.toPose ??
    ((obj: TObject) => (adapter ? adapter.getPose(obj.id) : (obj as unknown as TPose)));
  return {
    id: 'scene',
    label: 'Scene',
    draw: (ctx, _data, view) => {
      const objects = cfg.objects ?? adapter?.getObjects() ?? [];
      for (const obj of objects) {
        const pose: TPose = toPose(obj);
        cfg.drawOne(ctx, obj, pose, view);
        if (debugSink) {
          const b = boundsOfFn ? boundsOfFn(obj.id) : null;
          if (b) debugSink.recordBounds(obj.id, { x: b.x, y: b.y, width: b.width, height: b.height });
          const ox = (pose as { x?: number }).x ?? (b ? b.x : 0);
          const oy = (pose as { y?: number }).y ?? (b ? b.y : 0);
          debugSink.recordOrigin(obj.id, { x: ox, y: oy });
        }
      }
    },
  };
}
```

- [ ] **Step 2: Update the call site**

Find the `buildSceneLayer` invocation around lines 1042–1049:

```tsx
standardLayers.scene = buildSceneLayer<TObject, TPose>(
  sceneCfg,
  adapter,
  debugSink,
  effectiveBoundsOf,
  (id) => peekToolPose(id),
  () => peekToolHide(),
);
```

Replace with:

```tsx
standardLayers.scene = buildSceneLayer<TObject, TPose>(
  sceneCfg,
  adapter,
  debugSink,
  effectiveBoundsOf,
);
```

- [ ] **Step 3: Delete `peekToolPose` / `peekToolHide` if no remaining consumers**

Search the file for other call sites:

Run: `pnpm grep -n "peekToolPose\|peekToolHide" src/canvas/Canvas.tsx` (or use the Grep tool on the file).
- `peekToolHide` should now have zero call sites — delete it (~lines 804–808).
- `peekToolPose` is still consumed by the selection-overlay `poseById` resolver (~line 1070) so it tracks the active tool's ghost during a drag. **Keep `peekToolPose`.**

The selection overlay tracking the in-flight pose is the correct behavior — selection chrome should follow the ghost. The scene-drawing fold-in being dropped is the change.

- [ ] **Step 4: Update `helpersForLayers` if needed**

`helpersForLayers.getEffectivePose` and `getEffectiveBounds` still use `peekToolPose` / `peekToolBounds` (~lines 818–831). Keep them as-is — custom layers still want overlay-aware lookups.

- [ ] **Step 5: Run typecheck and tests**

Run: `pnpm typecheck && pnpm test --run`
Expected: PASS. Scene-drawing tests (e.g. SwillustratorDemo, BezierEditDemo) should still render committed state correctly; their ghost layers come through the overlay channel which is unchanged.

- [ ] **Step 6: Commit**

```bash
git add src/canvas/Canvas.tsx
git commit -m "refactor(Canvas): drop tool-overlay fold-in from buildSceneLayer"
```

---

## Task 6: Drop legacy gesture props from `CanvasProps`

**Files:**
- Modify: `src/canvas/Canvas.tsx`
- Modify: `docs/TODO.md`

After Task 4, the props `onBodyHit`, `onTapEmpty`, `handleHitRadius`, `resizeTarget`, `rotateTarget`, and `rotationHandleDistance` have no consumer inside Canvas. They're still in the prop type, however, so demos passing them silently compile. This task deletes them.

- [ ] **Step 1: Audit demos and apps for any remaining consumers**

Run: Grep tool with pattern `onBodyHit|onTapEmpty|handleHitRadius|resizeTarget|rotateTarget|rotationHandleDistance` over `demo/`, `apps/`, and `src/`.
Expected matches:
- `BezierEditDemo.tsx` — passes `handleHitRadius` to `useSelectWithAnchorEdit` (a hook option, **not** a Canvas prop). Keep.
- `Canvas.tsx` — internal state. To be deleted in this task.
- Anything else: convert to use the equivalent `useSelectTool` option, or remove entirely if it was already dead.

If any consumer still passes these as Canvas props, fix them in this same task (one commit) before continuing.

- [ ] **Step 2: Remove the props from `CanvasProps`**

In `src/canvas/Canvas.tsx` find the `CanvasProps` interface (~lines 219–230). Delete:

```tsx
resizeTarget?: () => { id: string; bounds: Bounds } | null;
rotateTarget?: () => { id: string; bounds: Bounds; rotation?: number } | null;
rotationHandleDistance?: number;
onBodyHit?: (ids: string[], ctx: PointerGestureCallbackCtx) => void;
onTapEmpty?: (ctx: PointerGestureCallbackCtx) => void;
handleHitRadius?: number;
```

Keep: `pickEvery`, `boundsOf`, `geometry`, `clientToWorld` — still consumed by selection-overlay handle hit-test and the active tool's `clientToWorld` plumbing.

- [ ] **Step 3: Remove the props from the destructuring**

Find the parameter destructuring inside `CanvasInner` (search for `function CanvasInner` and the `} = props;`). Delete the names that match Step 2.

- [ ] **Step 4: Drop the `PointerGestureCallbackCtx` type import if unused**

If after Step 3 there are no remaining references to `PointerGestureCallbackCtx` in `Canvas.tsx`, delete its import line.

Run: `pnpm typecheck`
Expected: PASS. Any error here means a Canvas-internal closure (e.g. multi-mode synthetic-id handling) still references the deleted type — track those down and remove them too. The cluster of multi-mode code (`MULTI_RESIZE_TARGET_ID`, `unionOfSelection`, `multiActive`, `effectiveResizeTarget`) was supporting the now-deleted `usePointerGestures` path. Most of `unionOfSelection` may now be dead — delete what's no longer reached.

- [ ] **Step 5: Defer the multi-resize peekBounds work**

The selection-overlay layer still has a multi-mode branch in `poseById` that returns the union AABB for the synthetic `MULTI_RESIZE_TARGET_ID` (~line 1064). After this plan lands, multi-resize is not the canvas's responsibility — it's the active tool's. Add a TODO entry instead of plumbing it now.

Append to `docs/TODO.md` under the appropriate "Tool primitive follow-ups" section (or create that heading if absent):

```markdown
- [ ] **Multi-resize peekBounds via the active tool.** The selection-overlay layer in `Canvas.tsx` still computes a multi-union for `MULTI_RESIZE_TARGET_ID` directly. Move that synthesis into `useSelectTool`'s `peekBounds(id)` so the canvas no longer special-cases the multi case. Tracked as deferral from `docs/plans/2026-05-05-canvas-inline-gesture-cleanup.md` Task 6.
```

- [ ] **Step 6: Run typecheck and tests**

Run: `pnpm typecheck && pnpm test --run`
Expected: PASS — 1194+ tests green.

- [ ] **Step 7: Commit**

```bash
git add src/canvas/Canvas.tsx docs/TODO.md
git commit -m "refactor(Canvas): drop legacy gesture-route props (onBodyHit, onTapEmpty, etc.)"
```

---

## Task 7: Final verification

**Files:** _none — verification only_

- [ ] **Step 1: Full typecheck**

Run: `pnpm typecheck`
Expected: clean.

- [ ] **Step 2: Full test suite**

Run: `pnpm test --run`
Expected: all green; no skipped legacy cases.

- [ ] **Step 3: Smoke-build the demo app**

Run: `pnpm build` (or whatever the demo build command is — check `package.json` `scripts`).
Expected: clean build.

- [ ] **Step 4: Manual demo walkthrough**

Start the demo dev server (`pnpm dev`) and click through each of the seven demos. For each, exercise:
- A body drag (move).
- A handle drag (resize).
- A click on empty space (clears selection where applicable).
- Any demo-specific gesture (alt-drag in CloneDemo, double-click in BezierEditDemo, T-key in TextDemo, group/ungroup in GroupsDemo).

If any regression is observed, file the offending demo + gesture as a follow-up TODO and address; don't paper over.

- [ ] **Step 5: No commit needed for verification.**

If all green, the cleanup is done. Move on to the next plan.
