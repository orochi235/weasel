# Revive layout-driven container reflow

**Date:** 2026-06-15
**Status:** Approved (design)
**Related TODO:** `docs/TODO.md` → "Container layout strategies (deferred…)" §, bullets for overlay rendering of reflowed siblings + name-quality pass.
**Supersedes the hook-era impl deleted in:** `0d9c0759` ("refactor(actions): delete legacy useMove hook (phase 14e t4)")

## Problem

Layout-driven container reflow — the drag-and-drop behavior where siblings shift
to make room as you drag an item into an auto-arranging container (row, grid,
ring), and the source container closes the gap behind it — is **currently dead in
the runtime**.

The drag-time layout pass lived in the `useMove` React hook, which was deleted in
`0d9c0759` when the kit migrated from the per-tool *hooks* model to the
*actions/dispatcher* model. The replacement (`moveAction` + dispatcher +
`usePreviewGhostLayer`) does reparent-on-drop but runs **no** sibling reflow.
Evidence the feature is disconnected, not merely refactored:

- `adapter.getLayout` has **zero callers** anywhere in `src/`.
- `MoveOverlay<TPose>` (the struct that carried `hypotheticalChildPositions` /
  `sourceReflowPositions`) is still defined and exported from `index.ts` but is
  **never constructed** — a dangling public type.
- `demo/demos/LayoutDemo.tsx` wires `layouts={…}` into `SceneCanvas`, but its
  integration test's real reflow assertion is `.skip`ped because nothing reflows.

So the cost of the feature is on the books (types, exports, `layouts` plumbing,
three strategies, a spec, ~10 TODO bullets) with none of the value connected.

## Goal

Reconnect layout reflow to the live action path so dragging a single node into a
layout-bearing container previews and commits sibling reflow, matching the
behavior the deleted hook had. Plus a name-quality pass on the layout surface.

## Locked decisions

1. **Render channel: fold into `previewIds`/`previewPose`.** Reflowing siblings
   ride the existing preview-ghost channel rather than a rebuilt overlay. Any id a
   handle returns from `previewIds()` already (a) has its committed paint hidden by
   `Canvas` (`hideIds`) and (b) renders as a ghost at `previewPose(id)`. Folding
   reflow poses into `moveAction`'s existing `scratch.previews` map gives sibling
   reflow rendering for free — and lets us **delete** `MoveOverlay` and its two
   badly-named fields outright.
2. **Single-select guard kept for v1.** Layout reflow/commit fires only when
   `draggedIds.length === 1` (exactly the old behavior). Multi-select falls through
   to the plain per-id transform batch. TODO:184 (multi-select-into-layout) stays.
3. **Rename `LayoutStrategy` methods** to a parallel, pose-aligned pair:
   `getChildPositions → childPoses` (resting layout), `reflowFor → reflowPoses`
   (mid-drag layout).

## Architecture

```
SceneCanvas `layouts` prop
        │  useLayoutDepSource (new, src/canvas/deps/)
        ▼
   deps.layout : LayoutDep  { getLayout(containerId) → LayoutStrategy | null }
        │
        ▼
moveAction.onMove  (single-select)
   walk containers under dragged center → pick deepest/topmost layout candidate
   → getDropTargets + snap.pickTarget
   → accepted: dest reflowPoses + source childPoses
   → fold sibling poses into scratch.previews
        │
        ▼
previewIds() / previewPose()  →  preview-ghost ghosts + Canvas hideIds   (no new render code)

moveAction.onEnd('commit')  (single-select + accepted)
   ops = layout.commitDrop(...) + source-reflow createTransformOp[]
   → scene.applyBatch (one undo entry)
```

## Components

### 1. New `layout` dep

- **File:** `src/canvas/deps/useLayoutDepSource.ts` (mirrors `useNodeAtPointDepSource`).
- **DepSchema entry** (in `src/interactions/actions/depSchema.ts`):
  ```ts
  /** Layout-strategy lookup by container id. Sourced by <SceneCanvas> from
   *  its `layouts` prop. Optional — moveAction skips the reflow pass when absent. */
  layout?: LayoutDep;
  ```
  where `interface LayoutDep { getLayout(containerId: string): LayoutStrategy<unknown> | null }`.
- **Source:** normalizes `SceneCanvas`'s existing `layouts` prop
  (`Record<string, LayoutStrategy> | ((id) => LayoutStrategy | null)`) into one
  `getLayout`. Registered next to the other `use*DepSource` calls in
  `SceneCanvasInner`.
- **Optional:** when the consumer passes no `layouts`, the dep is unregistered and
  `moveAction` behaves exactly as today.

### 2. `moveAction` reflow pass

`src/interactions/actions/defaults/move.ts`:

- Add `'layout'`-dep read in `start`; stash into `MoveScratch` (the dep plus a
  place to hold the resolved drop pass: target / layout / container / children /
  source-reflow poses, mirroring the deleted hook's `scratch.layoutPass`).
- Extend `MoveScratch.previews` usage: alongside dragged-root + cascade poses,
  `onMove` writes reflowing sibling poses keyed by their ids. Track the reflow ids
  separately so commit can distinguish them (they are NOT moved roots).
- **`onMove`** (only when `scratch.ids.length === 1`): port the candidate walk
  from the deleted hook, re-expressed against `scene` instead of the old adapter:
  - `scene.childrenOf(id)` / `scene.roots` / `scene.renderOrder()` for the tree
    walk and z-order; `scene.get(id).pose` / `.parent` for geometry/parentage.
  - deepest-wins, z-order tie-break by sibling-index path (same as old `zPath`).
  - `contains?` predicate honored; AABB fallback otherwise (TODO:182 unchanged).
  - On an accepted drop target: `layout.reflowPoses(...)` for dest children folded
    into `previews`; for a cross-container drag, `srcLayout.childPoses(...)` for the
    source leftovers, folding only the ids whose pose actually changed.
- **`onEnd('commit')`** (single-select + accepted, and no behavior claimed the
  commit): `ops = layout.commitDrop(...)` + one `createTransformOp` per
  source-reflow id; `scene.applyBatch(ops, label)`. Otherwise the existing
  reparent-on-drop / translate path runs unchanged. Behavior-pipeline precedence
  is unchanged (a behavior returning non-`undefined` still wins).

### 3. Render

No new code. The `previews` fold-in drives both the ghost (via
`usePreviewGhostLayer`) and committed-paint suppression (via `Canvas` `hideIds` /
`previewIdsExtra`).

### 4. Naming pass

- Rename on `LayoutStrategy` (`src/layout/types.ts`): `getChildPositions →
  childPoses`, `reflowFor → reflowPoses`. Update the three strategies
  (`freeform`, `tileGrid`, `snapPoint`), their unit tests, and `LayoutDemo`.
- Delete the orphaned `MoveOverlay<TPose>` interface (`src/interactions/gestures/
  types.ts`), its re-export from `src/index.ts`, and its two dead fields.

### 5. Tests

- Restore `move.layout.test.ts` (deleted in `0d9c0759`), adapted to the action
  path and the new method names — drives `moveAction` directly and asserts dest
  reflow + source reflow + commit ops.
- Unskip and strengthen the reflow assertion in
  `demo/demos/__tests__/layoutDemo.integration.test.tsx` as the end-to-end proof.

## Data flow (commit)

1. `onMove` resolves `{ layout, container, children, target, sourceReflowPoses }`
   into scratch each frame; folds preview poses for dest + source siblings.
2. `onEnd('commit')`: `commitDrop(container, children, dragged, target)` →
   reparent + dest poses; plus `createTransformOp` per source-reflow id.
3. `scene.applyBatch(ops, label)` → single undo entry.

## Visual note

Reflowing siblings render at the preview-ghost layer's blanket `0.85` alpha — same
as dragged ghosts — so mid-drag they appear semi-transparent at their destination
slots. Accepted for v1. Full-opacity live reflow is a follow-up (would need the
ghost layer to treat reflow ids differently from dragged ids).

## Out of scope (TODO bullets remain)

- Multi-select into a layout container (TODO:184).
- Drop-rejection signal / snap-back semantic (TODO:183).
- Non-rect `TPose` AABB fallback (TODO:182).
- Z-order walk across non-container ancestors (TODO:186).
- Tile-grid overflow policy (TODO:187) and the other P3 layout escape hatches.

## Verification

- `move.layout.test.ts` green against the action path.
- `LayoutDemo` integration assertion unskipped + passing.
- Manual: LayoutDemo in the dev server — drag a freeform child into the tileGrid;
  siblings reflow live (as ghosts), source closes its gap, drop commits as one
  undoable batch.
- Release gate: `tsc --noEmit && vitest run && tsup build`.
