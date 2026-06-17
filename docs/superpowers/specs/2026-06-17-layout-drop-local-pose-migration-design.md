# Layout-drop subsystem: migrate to local-pose (nesting) semantics

**Date:** 2026-06-17
**Status:** Draft — awaiting review
**Repo:** weasel (kit-core). Consumer that exposed the bug: eric (`plantingLayout`).

## Problem

Dragging a child (e.g. an eric planting) from one layout container into another
fails: the planting moves visually but stays parented to its old container
("stranded"). Worse, even when reparenting does fire, the dropped child can land
at the wrong absolute position under any non-origin container.

Root cause: the **layout-drop subsystem** in
`src/interactions/actions/defaults/move.ts` (`runLayoutPass` + the layout-drop
commit block) was written against **Scene v1 absolute-pose semantics** (every
node stores world coords) and was never migrated when the scene moved to
**hierarchical local poses** (`getPose(id)` returns the pose *relative to the
direct parent* — see `features/groups/composePose.ts`). The sibling
`applyReparent` path (the `reparentOnDrop` opt-in) *was* migrated and is the
reference pattern: it composes to world, then `rebaseLocalPose` back to local.

### Two coupled defects

**Defect 1 — the acceptance gate (`runLayoutPass`, move.ts:92–205).**
`draggedCenter` (line 101) is derived from the dragged node's **local** preview
pose; candidate container bounds (`node.pose`, line 124) are **local** too.
These are handed to `LayoutStrategy.contains` / `getDropTargets` / `snap`. But a
consumer strategy reasons in **world** (eric's `plantingLayout.contains` tests
the point against the container's world geometry `c.x/c.y`; `getDropTargets`
uses world `getPlantableBounds` and world child positions for occupancy; `snap`
compares against the world pointer `moveCtx.drag.current`). Local ≠ world
whenever the **source container is not at world origin** — i.e. the *common*
cross-container case, not just deep nesting. Result: `testInside` never matches
the destination → no `layoutPass` → fall-through to the translate-only commit →
reparent never happens.

**Defect 2 — the commit (move.ts:587–628).** Even once the gate passes, the
layout-drop commit reparents the dragged node under the destination container,
then applies `commitDrop`'s transform op whose pose is the strategy's **world**
drop cell. The scene stores **local** poses, so writing a world pose as the
new local pose lands the child off by the destination container's world origin.
The code comment at 599–602 still asserts "Scene v1's absolute-pose semantics."

## Goal / non-goals

**Goal:** Make the layout-drop subsystem correct under hierarchical local poses,
so cross-container drag-and-drop reparents *and* positions children correctly at
any nesting depth and any container origin. Bring it in line with the
already-migrated `applyReparent`.

**Non-goals:** No change to eric beyond what the chosen contract forces. No
change to the `reparentOnDrop` path (already correct). No new layout features.

## Design — pose-frame contract

**Decision: the `LayoutStrategy` callback contract operates in WORLD; the kit
translates at the scene boundary** — compose poses to world on the way *into*
the strategy, rebase world→local on the way *out* (previews + commit). This
matches `applyReparent` and requires **zero change to eric's strategy**, which
is already world-native. (Alternative considered — a container-local contract —
rejected below.)

The kit already has every primitive needed:
`scenePoseAdapter(scene)` (move.ts:218), `composeWorldPose`, `composeRectPose`,
`rebaseLocalPose`, `decomposeRectPose` (all imported at move.ts:61–63).

### Changes

**A. `runLayoutPass` — compose inputs to world (move.ts:92–205).**

1. Build `const poseAdapter = scenePoseAdapter(scene)` once.
2. `draggedCenter`: compose the dragged node to world, then add the world drag
   delta. Mirror `applyReparent`'s math (move.ts:345–350):
   `startWorld = composeWorldPose(adapter, draggedId, composeRectPose)`, then
   `+ (dx, dy)`. Take the center of that. (The dragged preview in `scratch.previews`
   is local-to-source; the delta is world, so composing the *start* pose to
   world and adding the delta is the correct world preview — same approach
   `applyReparent` uses.)
3. `testInside` / candidate bounds: in `consider`, compose the candidate
   container to world (`composeWorldPose(adapter, id, composeRectPose)`) and use
   that for both the `contains`/AABB test **and** the `Candidate.bounds` that
   becomes `container.bounds`.
4. `children[].pose`: compose each child to world before building the
   `LayoutChild[]` passed to the strategy.
5. `draggedArg.originPose` / `.pose`: world (composed start pose, and composed
   start + delta).
6. **Destination reflow fold (lines 173–177):** `reflowPoses` returns world
   poses. Before `scratch.previews.set(childId, pose)`, rebase each to the
   child's **current parent** frame (`rebaseLocalPose(adapter, worldPose,
   scene.get(childId).parent, composeRectPose, decomposeRectPose)`). Previews
   are local (confirmed: `usePreviewGhostLayer` substitutes `pose ?? node.pose`
   and composes through the parent chain).
7. **Source reflow fold (lines 179–202):** `childPoses` returns world; compare
   against the world-composed current pose to detect change. Store the **world**
   pose in `sourceReflow` (the canonical frame for the layoutPass record), and
   rebase to local at each consumption point — once here before
   `scratch.previews.set`, and again in the commit (step B). Source-reflow
   children keep their existing parent (the source container), so rebase under
   that parent.

**B. Layout-drop commit — rebase the drop pose to local (move.ts:587–628).**

This is the one spot that touches the public contract; see *Open decision*.

- The kit-issued reparent op (603–612) is unchanged.
- The dragged node's final pose must be written **local to the destination
  container**. Compute it exactly like `applyReparent`:
  `draggedWorld = startWorld + (dx,dy)`… but for a layout drop the landing pose
  is the **snapped target** (`lp.target.pose`, world), not the free drag delta.
  So: `localDrop = rebaseLocalPose(adapter, lp.target.pose, destId,
  composeRectPose, decomposeRectPose)` and write that.
- `sourceReflow` transform ops (613–620): `lp.sourceReflow` poses are world (per
  step A.7). Rebase each `to` to local under the child's parent (the source
  container, unchanged for these siblings) before building the transform op.

## Open decision (for review): how the drop pose gets rebased

`commitDrop` returns opaque `Op[]` with the world drop pose **baked into** a
`createTransformOp`. The kit cannot transparently rebase a pose inside an opaque
op. Two ways to resolve, both keeping eric world-native:

- **Option 1 (recommended) — kit owns the dragged node's drop write.** For a
  *cross-container* drop, the kit ignores `commitDrop`'s transform op for the
  dragged id and instead writes `rebaseLocalPose(lp.target.pose, destId)` itself
  (it already has `lp.target`). `commitDrop` still authors any *other* ops
  (e.g. same-container swaps, domain side-effects). For *same-container* drops
  (no reparent, frame unchanged) `commitDrop`'s ops apply as-is. Pro: public
  `LayoutStrategy` contract unchanged; kit owns frame translation, matching
  `applyReparent`. Con: kit special-cases the dragged id out of `commitDrop`'s
  output.

- **Option 2 — contract change: `commitDrop` returns world, kit rebases all.**
  Document that `commitDrop` poses are world and have the kit post-process every
  returned transform op, rebasing `to` to local under the op's (post-reparent)
  parent. Pro: uniform, no special-casing. Con: requires the kit to understand
  op internals / a new "world transform op" variant — a public-surface change.

Recommendation: **Option 1.** Smallest public-surface impact; the kit already
owns the analogous write in `applyReparent`.

### Alternative contract rejected: container-local

Passing strategy poses *relative to the destination container origin* would make
`commitDrop` poses equal the post-reparent scene-local pose (no rebase). But
eric's strategy is world-native today; adopting container-local forces a full
rewrite of eric's `contains`/`getDropTargets`/snap to subtract the container
origin, and still requires composing the dragged node to world first. More
consumer churn for no kit-side simplification. Rejected.

## Testing

`src/interactions/actions/defaults/move.layout.test.ts` currently encodes
**absolute** stub poses (e.g. `d1` at world 200 *inside* `D` at 200, both roots,
so local==world by accident). Under the world-composition change those stubs
would compose incorrectly (d1→400).

1. **Rewrite existing stubs to true local poses** (child of a container stores
   pose relative to that container) so they exercise the migrated path honestly.
   The same-container swap and the cross-container (roots) cases stay green.
2. **Add regression: non-origin source container.** Source container `C` at
   world `{40,40}`, child `a` local `{0,0}`; destination `D` at world `{200,0}`.
   Drag `a`'s world center into `D`. Assert: `runLayoutPass` finds `D` (gate),
   a `reparent(a→D)` op is emitted, and the committed transform writes `a`'s pose
   **local to D** such that its composed world position equals the snapped cell.
   This case fails on `main` (Defect 1 + Defect 2).
3. **Add regression: nested destination.** Destination container nested inside
   another container, so its world origin ≠ its local pose; assert the drop lands
   at the correct world position (guards the rebase direction).

TDD: write (2) first against the current code, watch it fall through to the
translate-only commit (no reparent op) — that red proves the diagnosis — then
implement A+B to green, then (1) and (3).

## Risk / blast radius

- `runLayoutPass` and the layout-drop commit are the only kit sites touched.
  `applyReparent`, `reparentOnDrop`, and non-layout move are untouched.
- Any *other* consumer with a world-native layout strategy benefits identically.
  A consumer that (incorrectly, today) relied on local poses reaching the
  strategy would change behavior — none known; the documented `LayoutStrategy`
  frame was always nominally world (it is for `tileGrid`, whose `cellRectAt`
  expresses cells in the container-bounds frame).
- Existing layout tests change (expected — they encoded the absolute-pose bug).
