# Canvas Inline Gesture Cleanup Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remove inline `useMove`/`useResize`/`useRotate` calls and the `buildSceneLayer` overlay fold-in from `<Canvas>`, leaving the Tool dispatcher path (`useSelectTool` via `tools={...}`) as the only gesture surface. Migrate the legacy demos and Canvas integration tests that still rely on the inline path.

**Architecture:** Today `<Canvas adapter={...}>` runs three internal gesture hooks (move/resize/rotate) and folds their live overlays into the scene layer's draw call via `buildSceneLayer`. The Tool primitive (`useSelectTool`) packages the same gestures behind one dispatcher and publishes ghosts via the overlay channel. Migration moves every consumer onto the tool dispatcher, then deletes the inline machinery — the Tool path becomes load-bearing, the inline path becomes dead code.

**Tech Stack:** React 18, TypeScript, Vitest, the kit's existing `useSelectTool` / `useTools` / `useSelection` / overlay-channel surface. No new deps.

**Source:** `docs/TODO.md` "Drop the remaining inline `useMove`/`useResize`/`useRotate` + scene-layer overlay fold-in from `Canvas.tsx`" (Tool primitive follow-ups).

---

## File Map

**Modify (per-demo migrations, additive — inline path still alive):**
- `demo/demos/ActionsDemo.tsx` — add `useSelectTool` + `useTools` so drag-to-move survives when inline path is removed.
- `demo/demos/GroupsDemo.tsx` — same plus `move.behaviors` / `resize.expandIds` plumbed via `useSelectTool` options.
- `demo/demos/CloneDemo.tsx` — same; verify alt-drag clone (separate `useClone` hook) still works alongside the tool dispatcher.
- `demo/demos/BezierEditDemo.tsx` — same plus `geometry: pathPoseDescriptor` threaded into `useSelectTool.resize`.
- `demo/demos/PathPoseDemo.tsx` — same as BezierEdit plus debug sink.
- `demo/demos/MoveDemo.tsx` — already dual-wired; drop the redundant `adapter={adapter}` prop on `<Canvas>` after Canvas no longer needs it for inline gestures (Task 8).
- `demo/demos/TextDemo.tsx` — already on `SceneCanvas`; no migration needed, just verify after Canvas.tsx changes.

**Modify (test migration):**
- `src/canvas/Canvas.test.tsx` — port the ~7 `Harness` tests that pass `moveOptions`/`resizeOptions` to a new harness that mounts `useSelectTool`. Tests that exercise gesture *semantics* (move, resize, group expand, multi-resize) move with the gestures; tests that exercise *Canvas integration* (inline gestures wired into adapter) get retired and replaced by tool-path equivalents.

**Modify (the strip):**
- `src/canvas/Canvas.tsx` — delete the inline `useMove`/`useResize`/`useRotate` calls, the `buildSceneLayer` overlay-fold-in branches, the `effectivePoseOf` / `baseBoundsOf` / `unionOfSelection` / `effectiveBoundsOf` closures, the `move`/`resize`/`rotate`/`snap`/`moveOptions`/`resizeOptions`/`rotateOptions` props, and the matching imports.

**Modify (helpersRef contract):**
- `src/canvas/Canvas.tsx` — `helpersRef.current.getEffectivePose(id)` / `getEffectiveBounds(id)` are exposed via the `helpersRef` ref. After cleanup they query the active Tool's overlay (via `tools.getActiveOverlays()` and a small adapter) instead of inline-gesture overlays. If no `tools` prop is supplied, they fall back to committed adapter pose/bounds.

**Modify (TODO):**
- `docs/TODO.md` — remove the entry under "Tool primitive follow-ups" once Task 9 lands. Per project memory: "Track every deferral in `docs/TODO.md`" — this work was already tracked there, and completion deletes the entry.

---

## Migration Pattern (read once, reuse for Tasks 1–5)

Every legacy demo currently has this shape:

```tsx
<Canvas
  adapter={adapter}
  // sometimes:
  moveOptions={{ behaviors: [...] }}
  resizeOptions={{ expandIds, behaviors: [...] }}
  snap={someSnap}
  // ...
/>
```

After migration, the same demo looks like:

```tsx
const select = useSelectTool<Obj, Pose>(adapter, {
  hitBody: (wx, wy) => /* same hit logic the demo already has, or a default */,
  boundsOf: (id) => /* same bounds lookup */,
  move: { behaviors: [...] },        // moveOptions.behaviors → here
  resize: { expandIds, behaviors: [...] },  // resizeOptions.* → here
  rotate: { behaviors: [...] },             // rotateOptions.* → here
  drawGhost: (ctx, obj, pose) => /* mirror scene drawOne */,
  getObject: (id) => /* lookup */,
});
const tools = useTools({ active: 'select', registry: { select } });

<Canvas
  adapter={adapter}
  tools={tools}     // <-- new
  // moveOptions/resizeOptions/rotateOptions/snap dropped
/>
```

Notes:
- `adapter` stays on `<Canvas>` until Task 8 — it's the scene-state source for `drawOne`.
- The adapter passed to `useSelectTool` and the one passed to `<Canvas>` should be the same object (or share the same `rectsRef` so they read the same source of truth).
- The adapter must implement `hitTestArea`, `applyOps`, `snapshotSelection` for `useSelectTool`'s area-select behavior. Demos that lack these need them added (most already include them or can no-op them).
- `useSelectTool`'s `move` / `resize` / `rotate` options accept the same `UseMoveOptions<TPose>` / `UseResizeOptions<TPose>` / `UseRotateOptions<TPose>` shapes as the inline path — drop the `Options` suffix and nest under `select`'s options object.
- `selectionOverlay: { handles: false }` in the demo's layer config still works — it's a Canvas-level flag, not a tool option.

Run the demo dev server to smoke-test each migration before committing:
```bash
npm run dev
# open the demo route, drag a rect, verify ghost + commit on release
```

---

## Task 1: Migrate ActionsDemo to useSelectTool

**Why first:** smallest surface — no resize, no rotate, no snap, no group cascade. Validates the migration pattern works.

**Files:**
- Modify: `demo/demos/ActionsDemo.tsx`

- [ ] **Step 1: Read current demo to lock in the existing shape**

```bash
cat demo/demos/ActionsDemo.tsx
```

Expected: file uses `<Canvas adapter={adapter} selection={selection} layers={...}>` with action hooks (`useEscape`, `useSelectAll`, `useDuplicate`, `useNudge`, `useReorder`) bound on the adapter. No `moveOptions` / `resizeOptions` / `tools` are passed. Drag-to-move is provided implicitly by the Canvas inline path.

- [ ] **Step 2: Update imports**

In `demo/demos/ActionsDemo.tsx`, extend the existing import block to add `useSelectTool` and `useTools`:

```tsx
import {
  arrayAdapter,
  Canvas,
  useEscape,
  useSelectAll,
  useDuplicate,
  useNudge,
  useReorder,
  useSelection,
  useSelectTool,
  useTools,
} from '@orochi235/weasel';
```

- [ ] **Step 3: Add hitTestArea / applyOps / snapshotSelection to the adapter**

`useSelectTool` requires these. ActionsDemo's adapter currently lacks them. Inside the existing `const adapter = { ... }` literal, add:

```tsx
hitTestArea: (r: Pose) =>
  rectsRef.current
    .filter((o) => o.x < r.x + r.width && o.x + o.width > r.x && o.y < r.y + r.height && o.y + o.height > r.y)
    .map((o) => o.id),
applyOps: () => {},
snapshotSelection: () => ({ items: [] }),
```

(`applyOps` and `snapshotSelection` are stubs — ActionsDemo uses no ops/clipboard.)

- [ ] **Step 4: Add useSelectTool + useTools right after the action hooks**

Below the existing `useReorder(adapter, ...)` line, add:

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
  drawGhost: (ctx, rect, pose) => {
    if (!rect) return;
    ctx.fillStyle = rect.color;
    ctx.fillRect(pose.x, pose.y, pose.width, pose.height);
  },
  getObject: (id) => rectsRef.current.find((r) => r.id === id) ?? null,
});
const tools = useTools({ active: 'select', registry: { select } });
```

- [ ] **Step 5: Pass tools to Canvas**

In the `<Canvas ... />` JSX, add `tools={tools}` alongside the existing `selection={selection}` prop:

```tsx
<Canvas
  width={W}
  height={H}
  className="ckd-canvas"
  adapter={adapter}
  selection={selection}
  tools={tools}
  layers={{
    scene: {
      drawOne: (cx, r, p) => {
        cx.fillStyle = r.color;
        cx.fillRect(p.x, p.y, p.width, p.height);
      },
    },
    selectionOverlay: { handles: false },
  }}
/>
```

- [ ] **Step 6: Run typecheck**

```bash
npx tsc --noEmit
```

Expected: no new errors in `demo/demos/ActionsDemo.tsx` (pre-existing demo errors elsewhere are fine — they predate this work).

- [ ] **Step 7: Smoke-test in a browser**

```bash
npm run dev
```

Open the ActionsDemo route. Verify:
- Click a rect — selection outline appears.
- Drag the rect — ghost follows pointer, commit on release.
- Click empty space + drag — area-select marquee draws and selects rects under it.
- Focus the demo, press Cmd-A — all rects select. Press arrow key — selection nudges. Press Esc — selection clears.

If drag doesn't work, useSelectTool isn't dispatching — check `hitBody` returns at least one id when over a rect, and that `tools={tools}` is actually on `<Canvas>`.

- [ ] **Step 8: Commit**

```bash
git add demo/demos/ActionsDemo.tsx
git commit -m "refactor(demo): wire ActionsDemo through useSelectTool"
```

---

## Task 2: Migrate GroupsDemo to useSelectTool

**Why second:** exercises group-aware `expandIds` on resize and group-aware `hitBody`/`boundsOf` — the most option-heavy migration.

**Files:**
- Modify: `demo/demos/GroupsDemo.tsx`

- [ ] **Step 1: Read current demo**

```bash
cat demo/demos/GroupsDemo.tsx
```

Note: identify the existing `moveOptions` and `resizeOptions` literals (likely include `expandIds` and behaviors). Note the existing `hitBody` and `boundsOf` props on `<Canvas>`. These all need to flow into `useSelectTool` options.

- [ ] **Step 2: Update imports**

Add `useSelectTool, useTools` to the `@orochi235/weasel` import block.

- [ ] **Step 3: Build useSelectTool below the adapter declaration**

Replace the inline `moveOptions` / `resizeOptions` / `hitBody` / `boundsOf` / `snap` props on `<Canvas>` with a `useSelectTool` call that consumes them. Concretely, add this block below the adapter declaration (use the existing demo's hit-test, bounds-of, expandIds, and behaviors expressions verbatim — copy them out of the JSX into the tool options):

```tsx
const select = useSelectTool<Obj, Pose>(adapter, {
  hitBody: /* paste the demo's existing hitBody expression */,
  boundsOf: /* paste the demo's existing boundsOf expression */,
  move: {
    behaviors: /* paste moveOptions.behaviors here, or [] if absent */,
  },
  resize: {
    expandIds: /* paste resizeOptions.expandIds here */,
    behaviors: /* paste resizeOptions.behaviors here, or [] if absent */,
  },
  drawGhost: (ctx, obj, pose) => {
    /* mirror the scene drawOne */
  },
  getObject: (id) => /* lookup */,
});
const tools = useTools({ active: 'select', registry: { select } });
```

- [ ] **Step 4: Strip the migrated props from `<Canvas>`**

Remove `moveOptions={...}`, `resizeOptions={...}`, `snap={...}`, `hitBody={...}`, `boundsOf={...}` from the `<Canvas>` JSX. Add `tools={tools}`.

- [ ] **Step 5: Run typecheck**

```bash
npx tsc --noEmit
```

Expected: no new errors in `demo/demos/GroupsDemo.tsx`.

- [ ] **Step 6: Smoke-test**

```bash
npm run dev
```

Open GroupsDemo. Verify:
- Click a leaf rect — single-select with handles.
- Click a group region — group selects (its descendants come along on drag).
- Shift-click — multi-select.
- Drag selection — group cascades, sibling reflow visible.
- Drag a corner handle — resize. For a group selection, all descendants resize proportionally.

- [ ] **Step 7: Commit**

```bash
git add demo/demos/GroupsDemo.tsx
git commit -m "refactor(demo): wire GroupsDemo through useSelectTool"
```

---

## Task 3: Migrate CloneDemo to useSelectTool

**Why third:** has a separate `useClone` hook layered over the inline path. Migration needs to verify both gesture sources (tool's move + clone's alt-drag) coexist without colliding.

**Files:**
- Modify: `demo/demos/CloneDemo.tsx`

- [ ] **Step 1: Read current demo**

```bash
cat demo/demos/CloneDemo.tsx
```

Note: identify whether the demo's pointer wiring is custom (its own `onPointerDown`/`Move`/`Up` on `<Canvas>`) or whether it uses the inline path implicitly. If custom pointer handlers are present and they consume the events, the tool dispatcher won't see them — keep custom handlers off the canvas event surface, or layer them via the gesture-priority chain.

- [ ] **Step 2: Update imports**

Add `useSelectTool, useTools` to the `@orochi235/weasel` import block.

- [ ] **Step 3: Build useSelectTool**

Same shape as ActionsDemo's tool block (move-only — clone runs alongside via its own hook). If the demo currently has `moveOptions.behaviors`, fold those into `move.behaviors`.

```tsx
const select = useSelectTool<Rect, Pose>(adapter, {
  hitBody: /* existing hit test */,
  boundsOf: /* existing bounds */,
  drawGhost: (ctx, r, p) => { /* mirror scene drawOne */ },
  getObject: (id) => /* lookup */,
});
const tools = useTools({ active: 'select', registry: { select } });
```

- [ ] **Step 4: Add tools to Canvas; remove inline-path gesture props**

Remove `moveOptions={...}`. Add `tools={tools}`.

- [ ] **Step 5: Verify useClone still attaches**

`useClone` is a standalone hook that listens for alt+drag at the document or canvas level. Confirm it still functions after this swap — if `useClone` collides with the tool dispatcher (alt-drag goes to one or the other), ship a fix in this same task: pass an alt-modifier guard into `useSelectTool`'s move (e.g., a behavior that no-ops `onStart` when `alt` is held), so clone wins on alt-drag and select wins otherwise.

If `useClone` currently uses its own pointer listeners on the canvas DOM, the tool dispatcher's listeners (also on the canvas) will fire too. The fix is the alt-modifier guard. Add it now if the smoke test reveals the collision.

- [ ] **Step 6: Run typecheck**

```bash
npx tsc --noEmit
```

- [ ] **Step 7: Smoke-test**

```bash
npm run dev
```

Open CloneDemo. Verify:
- Drag a rect normally — moves.
- Alt-drag a rect — clones (a new rect with a fresh id appears at drop point; original stays put).
- Click empty space + drag — area-select marquee.

- [ ] **Step 8: Commit**

```bash
git add demo/demos/CloneDemo.tsx
git commit -m "refactor(demo): wire CloneDemo through useSelectTool"
```

---

## Task 4: Migrate BezierEditDemo to useSelectTool

**Why fourth:** path-shaped poses — needs `geometry: pathPoseDescriptor` threaded into `useSelectTool.resize`. Validates the geometry-forwarding path.

**Files:**
- Modify: `demo/demos/BezierEditDemo.tsx`

- [ ] **Step 1: Read current demo**

```bash
cat demo/demos/BezierEditDemo.tsx
```

Note: pose is `Path` (multi-vertex). Demo passes `geometry={pathPoseDescriptor}`, possibly `handleHitRadius`, possibly `snap`. There's also the BezierEdit anchor-edit gesture, which is a separate hook (`useEditAnchors`) — it stays in place; only the body/handle drag moves to the tool.

- [ ] **Step 2: Update imports**

Add `useSelectTool, useTools, pathPoseDescriptor` (the last one only if not already imported) to the `@orochi235/weasel` import block.

- [ ] **Step 3: Build useSelectTool with geometry**

```tsx
const select = useSelectTool<PathObj, Path>(adapter, {
  hitBody: /* existing pointInPath-style hit */,
  boundsOf: /* boundsOfPath(pose) */,
  handleHitRadius: /* existing handleHitRadius if set, else default */,
  move: {
    behaviors: /* existing moveOptions.behaviors (likely [snap(...)]) */,
    translatePose: translatePath,
  },
  resize: {
    geometry: pathPoseDescriptor,
    behaviors: /* existing resizeOptions.behaviors */,
  },
  drawGhost: (ctx, obj, pose) => {
    /* trace the path, fill, stroke */
  },
  getObject: (id) => /* lookup */,
});
const tools = useTools({ active: 'select', registry: { select } });
```

- [ ] **Step 4: Strip migrated props from `<Canvas>`**

Remove `moveOptions={...}`, `resizeOptions={...}`, `snap={...}`, `geometry={...}` (the geometry prop on Canvas was only used by the inline resize path), `handleHitRadius={...}` if it's only feeding inline gestures (keep it if the selection overlay also reads it). Add `tools={tools}`.

- [ ] **Step 5: Run typecheck**

```bash
npx tsc --noEmit
```

- [ ] **Step 6: Smoke-test**

```bash
npm run dev
```

Open BezierEditDemo. Verify:
- Click a path — selects.
- Drag body — path moves (vertices translate together).
- Drag a corner handle — path bounds resize, vertices remap.
- Double-click a path (or whichever gesture enters anchor-edit mode) — anchors appear; drag an anchor; release — anchor moved. Body drag still works after exiting anchor-edit.

- [ ] **Step 7: Commit**

```bash
git add demo/demos/BezierEditDemo.tsx
git commit -m "refactor(demo): wire BezierEditDemo through useSelectTool"
```

---

## Task 5: Migrate PathPoseDemo to useSelectTool

**Why fifth:** same shape as BezierEditDemo plus a debug sink. Validates `useSelectTool({ debug })`.

**Files:**
- Modify: `demo/demos/PathPoseDemo.tsx`

- [ ] **Step 1: Read current demo**

```bash
cat demo/demos/PathPoseDemo.tsx
```

Note: similar to BezierEditDemo. The extra detail is the `debug` prop on `<Canvas>` and a `debug` field on `resizeOptions` / `moveOptions`. After migration, debug flows through `useSelectTool`'s `debug` option (one sink, used by all sub-gestures internally).

- [ ] **Step 2: Update imports**

Add `useSelectTool, useTools` (and `pathPoseDescriptor` if missing) to the `@orochi235/weasel` import block.

- [ ] **Step 3: Build useSelectTool with geometry + debug**

```tsx
const select = useSelectTool<PathObj, Path>(adapter, {
  hitBody: /* existing */,
  boundsOf: /* existing */,
  handleHitRadius: /* if set */,
  move: {
    behaviors: /* existing */,
    translatePose: translatePath,
  },
  resize: {
    geometry: pathPoseDescriptor,
    behaviors: /* existing */,
  },
  debug: /* the same debug sink the demo currently passes to Canvas */,
  drawGhost: (ctx, obj, pose) => { /* trace path */ },
  getObject: (id) => /* lookup */,
});
const tools = useTools({ active: 'select', registry: { select } });
```

- [ ] **Step 4: Strip migrated props from `<Canvas>`**

Remove `moveOptions`, `resizeOptions`, `snap`, `geometry`. Keep `debug={...}` on `<Canvas>` if the demo also wants it for layer-level debug; the tool's `debug` is a separate sink only consumed by gesture internals.

Add `tools={tools}`.

- [ ] **Step 5: Run typecheck**

```bash
npx tsc --noEmit
```

- [ ] **Step 6: Smoke-test**

```bash
npm run dev
```

Open PathPoseDemo. Same checks as BezierEditDemo. Additionally: confirm the debug overlay (origins, hit shapes, snap candidates) still draws.

- [ ] **Step 7: Commit**

```bash
git add demo/demos/PathPoseDemo.tsx
git commit -m "refactor(demo): wire PathPoseDemo through useSelectTool"
```

---

## Task 6: Verify MoveDemo + TextDemo are migration-clean

**Why sixth:** MoveDemo is already dual-wired (`tools={...}` and `adapter={...}` both present). TextDemo uses `SceneCanvas`, not `Canvas`. Both should survive the strip without further demo-side changes — this task verifies that with a smoke test before we strip Canvas internals.

**Files:**
- Read-only: `demo/demos/MoveDemo.tsx`, `demo/demos/TextDemo.tsx`

- [ ] **Step 1: Smoke-test MoveDemo with the inline path stripped (preview)**

(This step is informational; the strip happens in Task 8. Confirm now that MoveDemo's existing `useSelectTool` wiring covers all interactions used in the demo.)

```bash
npm run dev
```

Walk through MoveDemo: drag-to-move, area-select, snap-to-grid. Note any feature that's currently working but might depend on inline path internals — flag it now, fix it before Task 8.

- [ ] **Step 2: Smoke-test TextDemo**

In the same dev server: open TextDemo. Verify text renders, double-click enters edit mode, click outside commits, drag moves the text object. TextDemo uses `SceneCanvas` so the inline path isn't involved — this is a sanity check that nothing about the upcoming Canvas.tsx changes leaks into SceneCanvas.

- [ ] **Step 3: No commit**

This task is verification-only. Do not commit unless a fix was needed (in which case, commit the fix).

---

## Task 7: Migrate Canvas.test.tsx body/handle-drag tests to a tool harness

**Why seventh:** the ~7 inline-gesture integration tests in `src/canvas/Canvas.test.tsx` will break the moment Task 8 lands. They must be ported first.

**Files:**
- Modify: `src/canvas/Canvas.test.tsx`

- [ ] **Step 1: Read the test file end-to-end and inventory inline-path tests**

```bash
cat src/canvas/Canvas.test.tsx
```

Identify every test that constructs a `Harness` passing `moveOptions` / `resizeOptions` / `rotateOptions` to `<Canvas>`. From the prior survey, the suspects are around:
- `'default boundsOf folds move overlay → adapter fallback for resizeTarget'`
- `'explicit boundsOf prop wins over the default'`
- `'shift-click extends; clicking selected without shift drags whole set'`
- `'clicking inside the union AABB but on no leaf still drags the set'`
- `'corner handle on union AABB starts a group resize'`
- `'scroll-to-select in none mode'` (with `onTapEmpty` override)
- `'default hitBody scans move.adapter.getObjects()'`

Write the actual list down on paper / in a scratch file before editing.

- [ ] **Step 2: Replace the harness shape**

The current harness mounts `<Canvas adapter={adapter} moveOptions={...} resizeOptions={...}>`. Replace the body that constructs the props with a `useSelectTool` + `useTools` call, then mount `<Canvas adapter={adapter} tools={tools}>`. Concretely, in the `Harness` component (or wherever a single `<Canvas>` is mounted with gesture options):

Before (inline-path harness):
```tsx
function Harness({ adapter, moveBehaviors, resizeBehaviors, ... }) {
  return (
    <Canvas
      adapter={adapter}
      selection={...}
      moveOptions={{ behaviors: moveBehaviors }}
      resizeOptions={{ behaviors: resizeBehaviors }}
      width={300} height={200}
      layers={{ scene: { drawOne: () => {} } }}
    />
  );
}
```

After (tool-path harness):
```tsx
function Harness({ adapter, moveBehaviors, resizeBehaviors, hitBody, boundsOf, ... }) {
  const select = useSelectTool(adapter, {
    hitBody,
    boundsOf,
    move: { behaviors: moveBehaviors },
    resize: { behaviors: resizeBehaviors },
  });
  const tools = useTools({ active: 'select', registry: { select } });
  return (
    <Canvas
      adapter={adapter}
      selection={...}
      tools={tools}
      width={300} height={200}
      layers={{ scene: { drawOne: () => {} } }}
    />
  );
}
```

(Adjust the `Harness` prop list to thread whatever the test cases inject.)

- [ ] **Step 3: For each suspect test, port the assertion**

The behaviors-firing assertions stay the same — `useSelectTool` runs the same `useMove` / `useResize` / `useRotate` hooks under the hood, and behavior callbacks fire the same way. The only mechanical changes:
- Pass `behaviors` via `move`/`resize`/`rotate` keys, not `moveOptions`/`resizeOptions`/`rotateOptions` props.
- Where the test asserts on `<Canvas>`'s `boundsOf` / `hitBody` props, move those assertions to the `useSelectTool` options (the tool now owns hit-test and bounds resolution; the prop on Canvas no longer flows into the gesture pipeline).
- The `'corner handle on union AABB starts a group resize'` test depends on `useSelectTool` synthesizing the multi-resize target the same way the inline path did. Confirm `useSelectTool`'s `resize.expandIds` / multi-selection logic produces the same target — if not, fix it in `useSelectTool` (out of scope for the demo migration tasks, but in scope here).

- [ ] **Step 4: Run the test file**

```bash
npx vitest run src/canvas/Canvas.test.tsx
```

Expected: all tests pass. If a test fails:
- The behavior callback isn't firing → check `hitBody` returns ids when expected; check the harness's `boundsOf` is plumbed into `useSelectTool`.
- An overlay isn't reaching the scene draw → that's the next task's territory; for now, confirm the gesture *behavior* assertion is what you're checking, not a render assertion.

- [ ] **Step 5: Run the full test suite**

```bash
npx vitest run
```

Expected: pass (modulo the long-standing `LayoutDemo.tsx` / `move.layout.test.ts` / `layers.test.ts` failures noted in the survey — these predate this work and are out of scope. Document their status in the commit message if any new failures are introduced.).

- [ ] **Step 6: Commit**

```bash
git add src/canvas/Canvas.test.tsx
git commit -m "test(canvas): port body/handle-drag integration tests to useSelectTool harness"
```

---

## Task 8: Strip inline gestures from Canvas.tsx

**Why eighth:** all consumers (demos + tests) are now on the tool path. Time to delete the dead code.

**Files:**
- Modify: `src/canvas/Canvas.tsx`

- [ ] **Step 1: Delete imports**

Remove from `src/canvas/Canvas.tsx`:

```tsx
import { useMove } from '../interactions/gestures/move/move';
// ... and the corresponding useResize, useRotate imports
```

(Lines 35, 37, 39 per the survey. Also remove any type imports they brought in that no other code in this file uses — `MoveOverlay`, `ResizeOverlay`, `RotateOverlay`, `UseMoveOptions`, `UseResizeOptions`, `UseRotateOptions`.)

- [ ] **Step 2: Delete the gesture-options derivation block**

Remove lines ~704–732 (`derivedMoveOptions`, `derivedResizeOptions`, `derivedResizeOptionsFinal`, `derivedRotateOptions` `useMemo` blocks).

- [ ] **Step 3: Delete the gesture-hook calls**

Remove lines ~734–740:

```tsx
const internalMove = useMove<TObject, TPose>(effectiveAdapter, derivedMoveOptions);
const internalResize = useResize<TObject, TPose>(effectiveAdapter, derivedResizeOptionsFinal);
const internalRotate = useRotate<TObject, TPose>(effectiveAdapter, derivedRotateOptions);
```

And the conditional aliases:
```tsx
const move = adapter ? internalMove : undefined;
const resize = adapter ? internalResize : undefined;
const rotate = adapter ? internalRotate : undefined;
```

- [ ] **Step 4: Delete the overlay extraction**

Remove lines ~829–831:

```tsx
const moveOverlay = move?.overlay ?? null;
const resizeOverlay = resize?.overlay ?? null;
const rotateOverlay = rotate?.overlay ?? null;
```

- [ ] **Step 5: Delete `baseHitBody` fallback**

Remove lines ~833–852 (the `useMemo` that falls back to `move.adapter.getObjects()` for hitBody). The `hitBody` prop on Canvas is still accepted (for layer-level hit-test, e.g. selection overlay handle hit), but it no longer falls back to a gesture adapter — it falls back to the `<Canvas adapter>` if needed, or `() => null`.

- [ ] **Step 6: Delete `effectivePoseOf` / `baseBoundsOf` / `unionOfSelection` / `effectiveBoundsOf`**

Remove lines ~854–935. These four closures all exist only to fold inline-gesture overlays into committed pose/bounds lookups.

- [ ] **Step 7: Replace `helpersRef.current.getEffectivePose` / `getEffectiveBounds`**

These are exposed via `helpersRef` for custom layer authors. Now they should query the active tool's overlay for live ghost poses, falling back to committed adapter pose. Add a small inline helper near the helpersRef construction:

```tsx
const getEffectivePose = (id: string): TPose | null => {
  // Try the active tool's overlay first.
  const overlays = tools?.getActiveOverlays?.();
  if (overlays) {
    for (const o of overlays) {
      const p = o.poseOf?.(id);
      if (p) return p;
    }
  }
  return adapter?.getPose(id) ?? null;
};

const getEffectiveBounds = (id: string): Bounds | null => {
  const pose = getEffectivePose(id);
  if (!pose) return null;
  return geometry?.poseBounds(pose) ?? boundsFromPose(pose);
};
```

If `tools.getActiveOverlays` doesn't yet exist on the public surface, add it as a thin getter on the `ToolsApi` value returned by `useTools`. The data is already there — the dispatcher tracks the active tool's overlay each frame.

(If adding `getActiveOverlays` to `ToolsApi` would balloon scope, document the gap in `docs/TODO.md` and fall back to "committed pose only" for `getEffectivePose` in this task. Custom layers wanting overlay-fold-in then query the tool directly via the `tools` prop. Either path is acceptable — pick the smaller diff.)

- [ ] **Step 8: Delete `buildSceneLayer`**

Remove lines ~423–470 (the entire `buildSceneLayer` function). The standard scene layer config (`SceneSlotConfig.drawOne`) doesn't need overlay fold-in: tools publish their ghosts via the overlay channel, which renders on top of the scene layer in the Canvas's render order.

- [ ] **Step 9: Delete the buildSceneLayer wiring at the call site**

At lines ~1202–1211, replace the `buildSceneLayer(...)` call with the standard scene-layer assembly path that already exists for `tools={...}` consumers. The call site looks roughly like:

```tsx
// Before:
if (sceneCfg) {
  standardLayers.scene = buildSceneLayer(sceneCfg, adapter, moveOverlay, resizeOverlay, rotateOverlay, ..., effectiveBoundsOf);
}

// After:
if (sceneCfg) {
  standardLayers.scene = makeSceneLayer(sceneCfg, adapter);  // or whatever the existing tool-path uses
}
```

Find the existing tool-path wiring elsewhere in the file (search for the other `standardLayers.scene = ...` assignment if there is one) and unify on it.

- [ ] **Step 10: Delete the props from CanvasProps**

In the `CanvasProps<TObject, TPose>` interface (lines ~239–270 area), remove:
- `moveOptions?`
- `resizeOptions?`
- `rotateOptions?`
- `snap?` (the sweetener that prepended a snap behavior to `moveOptions`)

Keep `boundsOf?` and `hitBody?` — they still serve layer-level concerns (selection overlay handle hit-test, custom layer queries).

- [ ] **Step 11: Run typecheck**

```bash
npx tsc --noEmit
```

Expected: errors only in places where Canvas internals reference things you just deleted. Fix iteratively. Do NOT add back any of the deleted machinery to silence an error — if a downstream caller breaks, change the caller (or its calling code) to consume the tool path instead.

- [ ] **Step 12: Run the full test suite**

```bash
npx vitest run
```

Expected: pass.

- [ ] **Step 13: Smoke-test every demo**

```bash
npm run dev
```

Open in turn: ActionsDemo, GroupsDemo, CloneDemo, BezierEditDemo, PathPoseDemo, MoveDemo, TextDemo, NestedGroupsDemo. For each, drive a representative gesture (drag, resize, rotate where applicable, area-select, group/ungroup, clone, anchor-edit, text edit). All should work.

- [ ] **Step 14: Smoke-test swillustrator**

```bash
npm run dev:swill
```

Drag rects around, resize, area-select. Confirm no regression.

- [ ] **Step 15: Commit**

```bash
git add src/canvas/Canvas.tsx
git commit -m "$(cat <<'EOF'
refactor(canvas): drop inline useMove/useResize/useRotate; tools path is the only gesture surface

Removes the legacy inline-gesture path from <Canvas>: useMove/useResize/
useRotate calls, the moveOverlay/resizeOverlay/rotateOverlay fold-in
inside buildSceneLayer (the function itself is gone — the scene layer
now uses the standard tool-path assembly), the effectivePoseOf /
baseBoundsOf / unionOfSelection / effectiveBoundsOf closures, and the
moveOptions/resizeOptions/rotateOptions/snap props on CanvasProps.

helpersRef.current.getEffectivePose/getEffectiveBounds now query the
active Tool's overlay via tools.getActiveOverlays() instead of inline
gesture state, falling back to committed adapter pose when no Tool is
active. Custom layer authors who need ghost poses during a drag should
read them through this helper or via the tools prop directly.
EOF
)"
```

---

## Task 9: Update docs/TODO.md and barrel exports

**Why ninth:** delete the now-resolved entry from `docs/TODO.md` and audit `src/index.ts` for any newly-orphaned exports.

**Files:**
- Modify: `docs/TODO.md`
- Modify (audit only): `src/index.ts`

- [ ] **Step 1: Remove the TODO entry**

In `docs/TODO.md`, find the bullet under "Tool primitive follow-ups" that begins:
> **Drop the remaining inline `useMove`/`useResize`/`useRotate` + scene-layer overlay fold-in from `Canvas.tsx`.**

Delete the entire bullet (it's a multi-line entry — delete from the bullet marker through the trailing prose about `effectivePoseOf` / `baseBoundsOf`).

If during the cleanup we deferred any sub-decision (e.g. couldn't add `tools.getActiveOverlays` cleanly), per project memory ("Track every deferral in `docs/TODO.md`") add a new bullet under the same section capturing what was deferred and why.

- [ ] **Step 2: Audit barrel exports**

```bash
npx tsc --noEmit 2>&1 | head -50
```

Then check `src/index.ts` for re-exports of the now-internal types (e.g. `MoveOverlay`, `ResizeOverlay`, `RotateOverlay`, `UseMoveOptions`, etc. that might have been exposed only because Canvas's prop interface needed them). Keep the gesture-hook types exported (they're still public for advanced consumers) but drop any that were Canvas-only.

If unsure whether an export is still consumed externally, leave it. The cleanup is conservative — Canvas surface, not gesture-hook surface.

- [ ] **Step 3: Run typecheck + tests one last time**

```bash
npx tsc --noEmit && npx vitest run
```

Expected: all green.

- [ ] **Step 4: Commit**

```bash
git add docs/TODO.md src/index.ts
git commit -m "docs(todo): remove canvas inline-gesture cleanup entry; audit barrel exports"
```

---

## Self-Review Checklist (run after the plan is written, before starting Task 1)

1. **Spec coverage:**
   - Inline gesture removal from Canvas.tsx → Task 8.
   - Demo migrations → Tasks 1–6.
   - Test migrations → Task 7.
   - `effectivePoseOf` / `baseBoundsOf` story → Task 8 Step 7.
   - `buildSceneLayer` removal → Task 8 Step 8.
   - TODO bookkeeping → Task 9.
   - All seven demos enumerated in source TODO mentioned: MoveDemo (Task 6), ActionsDemo (Task 1), GroupsDemo (Task 2), CloneDemo (Task 3), BezierEditDemo (Task 4), PathPoseDemo (Task 5), TextDemo (Task 6).

2. **Placeholder scan:**
   - Tasks 2, 3, 4, 5 use `/* paste existing X */` placeholders inside code blocks. This is intentional — the demos' existing expressions for hitBody, boundsOf, behaviors, etc. are domain-specific and need to be transcribed verbatim. The instruction "paste the demo's existing X" is an explicit operation, not a vague hand-wave. Acceptable for this plan because the migration is mechanical; the engineer reads the existing demo and copies the literal expression into the new location.
   - No `TBD` / `implement later` / `add appropriate error handling`.

3. **Type consistency:**
   - `useSelectTool<TObject, TPose>` signature is consistent across tasks.
   - Option keys (`move.behaviors`, `resize.expandIds`, `rotate.behaviors`, `move.translatePose`, `resize.geometry`, `debug`, `drawGhost`, `getObject`) are consistent.
   - `tools.getActiveOverlays` referenced in Task 8 — flagged as possibly needing to be added; fallback path documented.

4. **Order dependency:** Tasks 1–6 (demo migrations) are independent of each other. Task 7 (test migration) depends on the inline path still being present (so it runs alongside the new harness setup). Task 8 (the strip) depends on Tasks 1–7 being complete. Task 9 (TODO cleanup) depends on Task 8.

---

## Execution Notes

- **Run order is sequential.** Each demo migration is a standalone commit. Tests follow demos. Strip follows tests. TODO bookkeeping follows strip.
- **Per project memory:** subagents default to opus.
- **Per project memory:** dark backdrop on demos — don't introduce new dark-on-dark chrome during ghost rendering. Reuse demo's existing palette.
- **Per project memory:** MoveDemo's snap is local-pose space — no world-coord conversion needed in the migration.
- **TODO file deferrals:** if anything gets deferred during execution, add a bullet to `docs/TODO.md` in the same commit (per project memory).
