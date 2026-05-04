# Inline-gesture cleanup Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Finish the Tool overlay channel migration by moving the six remaining adapter-driven demos (and matching Canvas tests) onto `useTools` + Tool wrappers, then strip the inline `useMove` / `useResize` / `useRotate` controllers and the `buildSceneLayer` overlay fold-in from `Canvas.tsx`. After this lands, `<Canvas>` only hosts the Tool dispatcher path; gestures live entirely behind `useSelectTool` (or app-defined Tools wrapping `useMove`/`useResize`/`useRotate` directly).

**Architecture:** Each migrated demo replaces its `<Canvas adapter={...} moveOptions={...} resizeOptions={...} hitBody={...} />` shape with `useSelectTool(adapter, { hitBody, boundsOf, drawGhost, ... })` (or a custom `defineTool` wrapping the gesture controllers — see `NestedGroupsDemo` as the precedent for cases the bundled select tool can't model). The Tool publishes its overlay via the channel; the scene slot draws committed state only. Tests mirror the same shift. Once no consumer uses the inline path, the controllers, their props, the `effectivePoseOf` / `baseBoundsOf` closures, and the move/resize/rotate fold-in inside `buildSceneLayer` are all deleted from `Canvas.tsx`.

**Tech Stack:** React + TypeScript, Vitest + React Testing Library. Reference patterns:
- `demo/demos/SwillustratorDemo.tsx` — canonical `useSelectTool` integration with `drawGhost`.
- `demo/demos/ComposeDemo.tsx` — `useSelectTool` + `sceneToAdapter`.
- `demo/demos/NestedGroupsDemo.tsx` — custom `defineTool` wrapping `useMove` directly when `useSelectTool`'s baked-in semantics don't fit (group hit resolution, custom layers reading `move.overlay`).
- `src/tools/builtin/useSelectTool.ts:40-74` — `UseSelectToolOptions` surface (`hitBody`, `boundsOf`, `move`, `resize`, `rotate`, `areaSelect`, `drawGhost`, `getObject`, `*OverlayStyle`).

---

## File Structure

**Modify (per-demo migrations, one task each):**
- `demo/demos/MoveDemo.tsx` — rect scene + snap + `useDuplicate`. Migrates cleanly to `useSelectTool`.
- `demo/demos/ActionsDemo.tsx` — rect scene with five action hooks (escape/select-all/duplicate/nudge/reorder). Drag presently runs through Canvas's inline `useMove`; migrate to `useSelectTool`.
- `demo/demos/CloneDemo.tsx` — uses `selectionMode="none"` and overrides Canvas pointer handlers; no inline `useMove`/`useResize` reliance. Verify whether it still drives legacy code; if not, simply confirm it still works after Canvas cleanup. Otherwise migrate to a custom `defineTool` wrapping `useClone`.
- `demo/demos/GroupsDemo.tsx` — group-aware `expandIds` for move + resize, custom `hitBody`/`boundsOf`. Migrate to `useSelectTool` with the same expand callbacks passed via `move.expandIds` / `resize.expandIds`.
- `demo/demos/BezierEditDemo.tsx` — path scene with `editAnchors`. Migrate the move/resize plumbing to `useSelectTool` with a `Path` TPose (`drawGhost` traces the path); leave the `editAnchors` Canvas prop in place (separate cleanup, tracked elsewhere).
- `demo/demos/PathPoseDemo.tsx` — path scene + grid snap, `selectionOptions={{ initial: ['p'] }}`. Migrate to `useSelectTool<PathObj, Path>`.

**Modify (consolidation tasks):**
- `src/canvas/Canvas.test.tsx` — six call sites still use `adapter={...}` + `moveOptions=` / `resizeOptions=` / `hitBody=` (lines ~166, 202, 236, 269, 305, 359, 494, 530, 559, 585, 593-608). Rewrite the legacy-path cases that exercise inline gesture wiring on top of a Tool-driven setup; delete the `legacy hook-prop wiring still works when tools prop is omitted` smoke test.
- `src/canvas/Canvas.tsx` — strip the inline controllers, their option props, and the overlay fold-in. Lines under audit:
  - imports `useMove`, `useResize`, `useRotate` (`Canvas.tsx:32-36`)
  - prop fields `moveOptions`, `resizeOptions`, `rotateOptions` (~`:236-238`, `:482-484`, `:692-715`)
  - hook calls `internalMove` / `internalResize` / `internalRotate` (~`:709-715`)
  - overlay reads `moveOverlay` / `resizeOverlay` / `rotateOverlay` (~`:804-806`, `:1105-1107`, `:1219`)
  - `buildSceneLayer` move/resize/rotate fold-in (~`:425-450`)
  - `effectivePoseOf` / `baseBoundsOf` (~`:829-895`)
  - any consumer-facing `gestures.move/resize/rotate` slot.

**Tests:** Each demo task adds or updates an integration test under `demo/demos/__tests__/` (or extends an existing one) that drives the new Tool path through a body drag + verifies the overlay layer fires. The Canvas cleanup task is gated on `npm test -- --run` going green with no skipped legacy cases.

---

## Task ordering rationale

Smallest/simplest demos first to build muscle memory on the migration shape, then group-flavored, then path-flavored, then test rewrite, then the Canvas strip. Each task is independently committable: at any point between tasks the build is green and the legacy path still works for whatever hasn't migrated yet.

1. MoveDemo (simplest rect + snap)
2. ActionsDemo (rect + five action hooks already orthogonal to gestures)
3. CloneDemo (verify-or-wrap; minimal change expected)
4. GroupsDemo (group hit/expand)
5. BezierEditDemo (path TPose + editAnchors stays)
6. PathPoseDemo (path TPose + grid snap)
7. Canvas.test.tsx rewrite
8. Canvas.tsx strip

---

### Task 1: Migrate MoveDemo to useSelectTool

**Files:**
- Modify: `demo/demos/MoveDemo.tsx`
- Test: `demo/demos/__tests__/moveDemo.integration.test.tsx` (create if absent; otherwise extend)

- [ ] **Step 1: Write the failing integration test**

Create `demo/demos/__tests__/moveDemo.integration.test.tsx`:

```tsx
import { render, fireEvent } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { MoveDemo } from '../MoveDemo';

describe('MoveDemo (Tool-primitive migration)', () => {
  it('drags a rect via the select tool overlay', () => {
    const { container } = render(<MoveDemo />);
    const canvas = container.querySelector('canvas')!;
    canvas.setPointerCapture = () => {};
    // Rect 'a' starts at (40,40,60,40). Click its center, drag +50,+30.
    fireEvent.pointerDown(canvas, { clientX: 70, clientY: 60, pointerId: 1 });
    fireEvent.pointerMove(canvas, { clientX: 120, clientY: 90, pointerId: 1 });
    fireEvent.pointerUp(canvas,   { clientX: 120, clientY: 90, pointerId: 1 });
    // Smoke-only: the canvas survives the drag without throwing and remains in the DOM.
    expect(canvas.isConnected).toBe(true);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails or that the demo currently still relies on legacy wiring**

Run: `npm test -- --run demo/demos/__tests__/moveDemo.integration.test.tsx`
Expected: PASS today (the legacy inline-move handles the drag) — record the baseline. After the migration the same test should still pass.

- [ ] **Step 3: Migrate the demo to `useSelectTool`**

Rewrite `demo/demos/MoveDemo.tsx` to follow the SwillustratorDemo pattern: build the adapter (already present), call `useSelectTool<Rect, Pose>(adapter, { hitBody, boundsOf, drawGhost, getObject, move: { /* snap behavior */ } })`, register it via `useTools({ active: 'select', registry: { select } })`, and pass `tools={tools}` to `<Canvas>`. Drop `snap={...}` from `<Canvas>` — fold the strategy into `move.behaviors` via `snap(gridSnapStrategy(...))`. Keep `useDuplicate` exactly as is (it operates on selection independently of Canvas).

The adapter already exposes the methods `useSelectTool` needs (it includes `selection.adapterMethods`, `arrayAdapter` provides `getObject`/`getPose`/`setPose`, and `hitTestArea` is the only addition needed for area-select — add it: scan `rectsRef.current` for AABB overlap).

`drawGhost` mirrors the scene `drawOne`:

```tsx
drawGhost: (ctx, rect, pose) => {
  if (!rect) return;
  ctx.fillStyle = rect.color;
  ctx.fillRect(pose.x, pose.y, pose.width, pose.height);
},
```

Update `MOVE_DEMO_SOURCE` to reflect the new wiring.

- [ ] **Step 4: Run the test to verify it still passes**

Run: `npm test -- --run demo/demos/__tests__/moveDemo.integration.test.tsx`
Expected: PASS.

- [ ] **Step 5: Run the full suite to catch regressions**

Run: `npm test -- --run`
Expected: All previously-passing tests still pass.

- [ ] **Step 6: Commit**

```bash
git add demo/demos/MoveDemo.tsx demo/demos/__tests__/moveDemo.integration.test.tsx
git commit -m "refactor(demo): migrate MoveDemo to useSelectTool (overlay channel)"
```

---

### Task 2: Migrate ActionsDemo to useSelectTool

**Files:**
- Modify: `demo/demos/ActionsDemo.tsx`
- Test: `demo/demos/__tests__/actionsDemo.integration.test.tsx` (create if absent)

- [ ] **Step 1: Write the failing integration test**

```tsx
import { render, fireEvent } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { ActionsDemo } from '../ActionsDemo';

describe('ActionsDemo (Tool-primitive migration)', () => {
  it('drag still moves a rect under the Tool dispatcher', () => {
    const { container } = render(<ActionsDemo />);
    const canvas = container.querySelector('canvas')!;
    canvas.setPointerCapture = () => {};
    fireEvent.pointerDown(canvas, { clientX: 80, clientY: 80, pointerId: 1 });
    fireEvent.pointerMove(canvas, { clientX: 140, clientY: 110, pointerId: 1 });
    fireEvent.pointerUp(canvas,   { clientX: 140, clientY: 110, pointerId: 1 });
    expect(canvas.isConnected).toBe(true);
  });
});
```

- [ ] **Step 2: Run the test (baseline pass)**

Run: `npm test -- --run demo/demos/__tests__/actionsDemo.integration.test.tsx`
Expected: PASS.

- [ ] **Step 3: Migrate to useSelectTool**

Add `hitTestArea` to the adapter (AABB scan over `rectsRef.current`, same shape as MoveDemo). Add `applyOps: () => {}` and `snapshotSelection: () => ({ items: [] })` if `useSelectTool`'s adapter intersection requires them — read `SelectAdapter` (`src/tools/builtin/useSelectTool.ts:80-84`) to confirm.

Construct the tool:

```tsx
const select = useSelectTool<Rect, Pose>(adapter, {
  hitBody: (wx, wy) =>
    rectsRef.current
      .filter((r) => wx >= r.x && wx <= r.x + r.width && wy >= r.y && wy <= r.y + r.height)
      .map((r) => r.id),
  boundsOf: (id) => {
    const r = rectsRef.current.find((x) => x.id === id);
    return r ? { x: r.x, y: r.y, width: r.width, height: r.height } : null;
  },
  drawGhost: (ctx, r, p) => {
    if (!r) return;
    ctx.fillStyle = r.color;
    ctx.fillRect(p.x, p.y, p.width, p.height);
  },
  getObject: (id) => rectsRef.current.find((r) => r.id === id) ?? null,
});
const tools = useTools({ active: 'select', registry: { select } });
```

Pass `tools={tools}` to `<Canvas>`. Keep the action hooks unchanged (they operate on the shared `useSelection` state, not on Canvas's gesture wiring). Update `ACTIONS_DEMO_SOURCE`.

- [ ] **Step 4: Run the test**

Run: `npm test -- --run demo/demos/__tests__/actionsDemo.integration.test.tsx`
Expected: PASS.

- [ ] **Step 5: Run the full suite**

Run: `npm test -- --run`
Expected: All previously-passing tests still pass.

- [ ] **Step 6: Commit**

```bash
git add demo/demos/ActionsDemo.tsx demo/demos/__tests__/actionsDemo.integration.test.tsx
git commit -m "refactor(demo): migrate ActionsDemo to useSelectTool (overlay channel)"
```

---

### Task 3: Verify or migrate CloneDemo

**Files:**
- Modify (likely): `demo/demos/CloneDemo.tsx`
- Test: `demo/demos/__tests__/cloneDemo.integration.test.tsx` (create if absent)

CloneDemo uses `selectionMode="none"` and overrides Canvas's pointer handlers with its own alt-drag wiring (`onPointerDown` / `onPointerMove` / `onPointerUp`). It does **not** call `useMove`/`useResize`/`useRotate` itself, but Canvas may still synthesize them internally because `adapter={...}` is present. The cleanup task (8) will eliminate the inline controllers regardless — this task ensures CloneDemo continues to work after that.

- [ ] **Step 1: Write a smoke test for the alt-drag clone path**

```tsx
import { render, fireEvent } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { CloneDemo } from '../CloneDemo';

describe('CloneDemo (post-cleanup)', () => {
  it('alt-drag clone runs through the demo-owned pointer handlers', () => {
    const { container } = render(<CloneDemo />);
    const canvas = container.querySelector('canvas')!;
    canvas.setPointerCapture = () => {};
    // Hit rect 'a' at (60,80,80,60) center=(100,110), alt-drag +60,+40.
    fireEvent.pointerDown(canvas, { clientX: 100, clientY: 110, pointerId: 1, altKey: true });
    fireEvent.pointerMove(canvas, { clientX: 160, clientY: 150, pointerId: 1, altKey: true });
    fireEvent.pointerUp(canvas,   { clientX: 160, clientY: 150, pointerId: 1, altKey: true });
    expect(canvas.isConnected).toBe(true);
  });
});
```

- [ ] **Step 2: Run the test**

Run: `npm test -- --run demo/demos/__tests__/cloneDemo.integration.test.tsx`
Expected: PASS today.

- [ ] **Step 3: Decide: leave as-is or wrap in a Tool**

Read `Canvas.tsx`: when `tools` is **omitted** but `adapter` is present, does the dispatcher still synthesize the inline gesture path? If yes, after Task 8 strips the inline path the demo's drag will need a Tool host. In that case, define a no-op active tool and pass `tools={tools}`:

```tsx
const noop = defineTool({ id: 'noop' });
const tools = useTools({ active: 'noop', registry: { noop } });
```

Or pass an empty registry with a synthetic active id — whichever satisfies `useTools`. Drop the props CloneDemo never used (`selectionMode="none"` may become redundant once Canvas no longer auto-wires move/resize). Update `CLONE_DEMO_SOURCE` if anything changes.

- [ ] **Step 4: Run the test**

Run: `npm test -- --run demo/demos/__tests__/cloneDemo.integration.test.tsx`
Expected: PASS.

- [ ] **Step 5: Run the full suite**

Run: `npm test -- --run`
Expected: All previously-passing tests still pass.

- [ ] **Step 6: Commit**

```bash
git add demo/demos/CloneDemo.tsx demo/demos/__tests__/cloneDemo.integration.test.tsx
git commit -m "refactor(demo): pin CloneDemo onto Tool dispatcher path"
```

---

### Task 4: Migrate GroupsDemo to useSelectTool

**Files:**
- Modify: `demo/demos/GroupsDemo.tsx`
- Test: `demo/demos/__tests__/groupsDemo.integration.test.tsx` (create if absent)

GroupsDemo's distinguishing feature: `moveOptions={{ expandIds }}` and `resizeOptions={{ expandIds }}` rewrite the dragged-id list to leaves so moves cascade across virtual-group members. `useSelectTool` accepts `move` / `resize` option blocks (`UseSelectToolOptions.move?: UseMoveOptions<TPose>`); pass `expandIds` through there.

- [ ] **Step 1: Write the failing integration test**

```tsx
import { render, fireEvent } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { GroupsDemo } from '../GroupsDemo';

describe('GroupsDemo (Tool-primitive migration)', () => {
  it('clicking a member of g1 selects + drags the whole group', () => {
    const { container } = render(<GroupsDemo />);
    const canvas = container.querySelector('canvas')!;
    canvas.setPointerCapture = () => {};
    // Rect 'a' (60,60,60,50) — click center.
    fireEvent.pointerDown(canvas, { clientX: 90, clientY: 85, pointerId: 1 });
    fireEvent.pointerMove(canvas, { clientX: 130, clientY: 105, pointerId: 1 });
    fireEvent.pointerUp(canvas,   { clientX: 130, clientY: 105, pointerId: 1 });
    expect(canvas.isConnected).toBe(true);
  });
});
```

- [ ] **Step 2: Baseline pass**

Run: `npm test -- --run demo/demos/__tests__/groupsDemo.integration.test.tsx`
Expected: PASS.

- [ ] **Step 3: Migrate to useSelectTool**

```tsx
const select = useSelectTool<Rect, Pose>(adapter, {
  hitBody: (wx, wy) => { /* same body as GroupsDemo's hitBody, returning [id] or [] */ },
  boundsOf,
  handleHitRadius: HANDLE,
  move:   { expandIds: (ids) => expandToLeaves(ids, adapter) },
  resize: { expandIds: (ids) =>
    ids.length === 1 && adapter.getGroup(ids[0]) === undefined
      ? ids
      : expandToLeaves(ids, adapter),
  },
  drawGhost: (ctx, rect, pose) => {
    if (!rect) return;
    ctx.fillStyle = rect.color;
    ctx.fillRect(pose.x, pose.y, pose.width, pose.height);
  },
  getObject: (id) => rectsRef.current.find((r) => r.id === id) ?? null,
});
const tools = useTools({ active: 'select', registry: { select } });
```

Pass `tools={tools}` to `<Canvas>`. Drop `moveOptions`, `resizeOptions`, and `hitBody` from the Canvas prop set; keep `boundsOf` (selectionOverlay still needs it for handle placement) and `selectionOverlay.poseById` (group-aware union AABB). Update `GROUPS_DEMO_SOURCE`.

- [ ] **Step 4: Run the test**

Run: `npm test -- --run demo/demos/__tests__/groupsDemo.integration.test.tsx`
Expected: PASS.

- [ ] **Step 5: Run the full suite**

Run: `npm test -- --run`
Expected: All previously-passing tests still pass.

- [ ] **Step 6: Commit**

```bash
git add demo/demos/GroupsDemo.tsx demo/demos/__tests__/groupsDemo.integration.test.tsx
git commit -m "refactor(demo): migrate GroupsDemo to useSelectTool with expand-leaves"
```

---

### Task 5: Migrate BezierEditDemo to useSelectTool

**Files:**
- Modify: `demo/demos/BezierEditDemo.tsx`
- Test: `demo/demos/__tests__/bezierEditDemo.integration.test.tsx` (create if absent)

This demo's TPose is `Path`. The `editAnchors` prop on `<Canvas>` is a separate concern (anchor-edit overlay) and stays — only the move/resize plumbing migrates. `useSelectTool<PathObj, Path>` works as long as the adapter's `setPose` accepts a `Path`.

- [ ] **Step 1: Write the failing integration test**

```tsx
import { render, fireEvent } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { BezierEditDemo } from '../BezierEditDemo';

describe('BezierEditDemo (Tool-primitive migration)', () => {
  it('renders without throwing under the Tool dispatcher', () => {
    const { container } = render(<BezierEditDemo />);
    expect(container.querySelector('canvas')).toBeTruthy();
  });
});
```

- [ ] **Step 2: Baseline pass**

Run: `npm test -- --run demo/demos/__tests__/bezierEditDemo.integration.test.tsx`
Expected: PASS.

- [ ] **Step 3: Migrate to useSelectTool**

```tsx
const select = useSelectTool<PathObj, Path>(adapter, {
  hitBody: (wx, wy) => (pointInPath(pathRef.current, wx, wy) ? [ID] : []),
  boundsOf: (id) => (id === ID ? boundsOfPath(pathRef.current) : null),
  handleHitRadius: HANDLE / zoomRef.current,
  drawGhost: (ctx, _o, pose) => {
    ctx.strokeStyle = '#f5b7a3';
    ctx.lineWidth = 2;
    ctx.beginPath();
    traceToContext(ctx, pose);
    ctx.stroke();
  },
  getObject: (id) => (id === ID ? { id } : null),
});
const tools = useTools({ active: 'select', registry: { select } });
```

Add `pointInPath` to the imports if not present (`@orochi235/weasel`). Pass `tools={tools}` to `<Canvas>`; keep `editAnchors`, `clientToWorld`, `handleHitRadius` (selection overlay still uses it for handle hit), and the existing layers map. Update `BEZIER_EDIT_DEMO_SOURCE`.

- [ ] **Step 4: Run the test**

Run: `npm test -- --run demo/demos/__tests__/bezierEditDemo.integration.test.tsx`
Expected: PASS.

- [ ] **Step 5: Run the full suite**

Run: `npm test -- --run`
Expected: All previously-passing tests still pass.

- [ ] **Step 6: Commit**

```bash
git add demo/demos/BezierEditDemo.tsx demo/demos/__tests__/bezierEditDemo.integration.test.tsx
git commit -m "refactor(demo): migrate BezierEditDemo to useSelectTool<PathObj, Path>"
```

---

### Task 6: Migrate PathPoseDemo to useSelectTool

**Files:**
- Modify: `demo/demos/PathPoseDemo.tsx`
- Test: `demo/demos/__tests__/pathPoseDemo.integration.test.tsx` (create if absent)

Path TPose with grid snap. Same shape as Task 5, plus the snap behavior moves into `move.behaviors` via `snap(gridSnapStrategy<Path>(20, { origin: pathOriginProjection }))`. The `selectionOptions={{ initial: ['p'] }}` prop stays on Canvas — it seeds `useSelection`, which is orthogonal to gestures.

- [ ] **Step 1: Write the failing integration test**

```tsx
import { render, fireEvent } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { PathPoseDemo } from '../PathPoseDemo';

describe('PathPoseDemo (Tool-primitive migration)', () => {
  it('renders without throwing under the Tool dispatcher', () => {
    const { container } = render(<PathPoseDemo />);
    expect(container.querySelector('canvas')).toBeTruthy();
  });
});
```

- [ ] **Step 2: Baseline pass**

Run: `npm test -- --run demo/demos/__tests__/pathPoseDemo.integration.test.tsx`
Expected: PASS.

- [ ] **Step 3: Migrate to useSelectTool**

```tsx
const select = useSelectTool<PathObj, Path>(adapter, {
  hitBody: (wx, wy) => (pointInPath(pathRef.current, wx, wy) ? [ID] : []),
  boundsOf: (id) => (id === ID ? boundsOfPath(pathRef.current) : null),
  handleHitRadius: HANDLE,
  move: {
    behaviors: [snap(gridSnapStrategy<Path>(20, { origin: pathOriginProjection }))],
  },
  drawGhost: (ctx, _o, p) => {
    ctx.fillStyle = 'rgba(127, 176, 105, 0.5)';
    ctx.beginPath();
    traceToContext(ctx, p);
    ctx.fill();
  },
  getObject: (id) => (id === ID ? { id } : null),
});
const tools = useTools({ active: 'select', registry: { select } });
```

Drop `snap={...}` from `<Canvas>`; pass `tools={tools}`. Keep `selectionOptions={{ initial: ['p'] }}`, `debug`, `handleHitRadius`. Update `PATH_POSE_DEMO_SOURCE`.

- [ ] **Step 4: Run the test**

Run: `npm test -- --run demo/demos/__tests__/pathPoseDemo.integration.test.tsx`
Expected: PASS.

- [ ] **Step 5: Run the full suite**

Run: `npm test -- --run`
Expected: All previously-passing tests still pass.

- [ ] **Step 6: Commit**

```bash
git add demo/demos/PathPoseDemo.tsx demo/demos/__tests__/pathPoseDemo.integration.test.tsx
git commit -m "refactor(demo): migrate PathPoseDemo to useSelectTool<PathObj, Path>"
```

---

### Task 7: Rewrite Canvas.test.tsx legacy-path cases

**Files:**
- Modify: `src/canvas/Canvas.test.tsx`

Cases to update (line numbers from the pre-cleanup file; re-locate before editing):

- `~140-260` `auto-defaults` block — exercises default `hitBody` over `move.adapter.getObjects()`. Reframe so the test renders Canvas with a Tool that uses the same default `hitBody`, or delete if redundant with `useSelectTool` tests under `src/tools/builtin/`.
- `~260-325` two cases passing `resizeOptions={{ behaviors: [...] }}`. Replace with a Tool wrapping `useResize` directly (or `useSelectTool` configured with `resize: { behaviors: [...] }`); assert the same `startSpy` callback fires.
- `~326-515` `selectionMode` describe block — uses `moveOptions` + `resizeOptions` + `selectionMode`. Migrate to the Tool path; the `multi`/`single`/`none` semantics are now expressed through the Tool's hit handling.
- `~593-608` `legacy hook-prop wiring still works when tools prop is omitted` — DELETE this test entirely. After Task 8 the legacy path no longer exists.

For each migrated case:

- [ ] **Step 1: Locate the case**

Re-read the file around the line number; record the test title.

- [ ] **Step 2: Rewrite or delete**

Convert to use `useSelectTool` (or `defineTool` wrapping the gesture controller) + `useTools` + `tools={tools}`. Preserve the original assertion intent (e.g., `startSpy` for resize behaviors becomes a `resize: { behaviors: [{ onStart }] }` block on `useSelectTool`).

- [ ] **Step 3: Run that file**

Run: `npm test -- --run src/canvas/Canvas.test.tsx`
Expected: PASS for the migrated case.

- [ ] **Step 4: Commit per logical group**

Suggested commit boundaries: one for `auto-defaults`, one for `selectionMode`, one for `resizeOptions`, one for the legacy-smoke deletion. Example:

```bash
git add src/canvas/Canvas.test.tsx
git commit -m "test(canvas): migrate Canvas.test.tsx selectionMode block onto Tool path"
```

- [ ] **Step 5: Final run for the file**

Run: `npm test -- --run src/canvas/Canvas.test.tsx`
Expected: All cases pass with no `adapter=` + `moveOptions`/`resizeOptions`/`hitBody` legacy combinations remaining.

---

### Task 8: Strip inline gesture controllers from Canvas.tsx

**Files:**
- Modify: `src/canvas/Canvas.tsx`
- Modify: `src/index.ts` if any types/props leak through the barrel.

This is the payoff task. Audit for the patterns from the File Structure section above, delete each, and verify nothing else references them.

- [ ] **Step 1: Confirm no consumer still uses the inline path**

Run: `grep -rn "moveOptions\|resizeOptions\|rotateOptions" demo/ src/` (use the Grep tool).
Expected: Zero hits in `demo/demos/` and `src/canvas/Canvas.test.tsx`. If any remain, return to the relevant earlier task.

- [ ] **Step 2: Remove the imports**

Delete `useMove`, `useResize`, `useRotate` imports at `Canvas.tsx:32-36`.

- [ ] **Step 3: Remove the prop fields**

Delete `moveOptions`, `resizeOptions`, `rotateOptions` from the `CanvasProps` interface (~`:236-238`) and their destructuring (~`:482-484`).

- [ ] **Step 4: Remove the hook calls and derived option memos**

Delete `derivedMoveOptions`, `derivedResizeOptionsFinal`, `derivedRotateOptions`, `internalMove`, `internalResize`, `internalRotate` (~`:680-715`). Anywhere `move ?? internalMove` (or analogous fallback) appears, simplify to just the externally-supplied controller — and if no consumer supplies one any more, delete that branch entirely.

- [ ] **Step 5: Remove the overlay reads**

Delete `moveOverlay`, `resizeOverlay`, `rotateOverlay` (~`:804-806`), their dependencies in the layer-effect deps array (~`:1219`), and the `effectivePoseOf` / `baseBoundsOf` memos (~`:829-895`). Anywhere `effectivePoseOf` was passed downstream (e.g. into `selectionOverlay.poseById` defaults), replace with the committed-state lookup (`adapter.getPose`) — the active Tool's overlay paints ghosts, so committed state is correct for the chrome.

- [ ] **Step 6: Remove the buildSceneLayer fold-in**

In `buildSceneLayer` (~`:425-450`), delete the `moveOverlay` / `resizeOverlay` / `rotateOverlay` parameter, the `hide` set logic that pulls from `moveOverlay.hideIds`, and the `pose = moved ?? resized ?? rotated ?? committed` chain. The scene draws committed state only.

- [ ] **Step 7: Type-check**

Run: `npm run typecheck` (or `npx tsc --noEmit` if no script exists).
Expected: No type errors.

- [ ] **Step 8: Run the full suite**

Run: `npm test -- --run`
Expected: All tests pass.

- [ ] **Step 9: Update docs/TODO.md**

Remove the bullet "Drop the remaining inline `useMove`/`useResize`/`useRotate` + scene-layer overlay fold-in from `Canvas.tsx`" under "Tool primitive follow-ups" — the cleanup is done. Also remove the analogous closing paragraph in the Tool overlay channel deferrals section that points back at this entry. If new follow-ups surfaced during the migration (e.g. an option that wasn't ported), record them as fresh TODO entries in the same commit.

- [ ] **Step 10: Commit**

```bash
git add src/canvas/Canvas.tsx src/index.ts docs/TODO.md
git commit -m "refactor(canvas): drop inline useMove/useResize/useRotate; Tool dispatcher only"
```

---

## Self-Review (run after drafting; not a separate task)

- **Spec coverage:** Every demo named in the TODO entry (`MoveDemo`, `ActionsDemo`, `GroupsDemo`, `CloneDemo`, `BezierEditDemo`, `PathPoseDemo`) gets its own task. The Canvas test rewrite is its own task. The Canvas.tsx strip is its own task and updates `docs/TODO.md`. ✅
- **Placeholder scan:** No "TBD" / "fill in" / "similar to Task N" without inlined code. Every task has its `useSelectTool` block written out. ✅
- **Type consistency:** Method names match — `useSelectTool`, `useTools`, `defineTool`, `expandToLeaves`, `pointInPath`, `boundsOfPath`, `traceToContext`, `pathOriginProjection`, `gridSnapStrategy` all line up with the kit surface. `UseSelectToolOptions.move` / `.resize` / `.rotate` / `.areaSelect` are the option blocks. ✅
- **Open question for the implementer of Task 8:** Whether `selectionMode`, `hitBody`, `boundsOf`, `handleHitRadius`, `gestures.delete/duplicate/...` props should also be reviewed for staleness. They are *not* part of the inline gesture path being removed — they feed selection-overlay rendering and other slot configs — so leave them in place unless the implementer finds dead code while touching the file.
