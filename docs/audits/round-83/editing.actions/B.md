# Audit round 83 — editing.actions — reviewer findings

## Make Boolean Group ignores locked operands, unlike Group
- where: packages/editing/src/actions/pathfinder/booleanGroupAction.ts:89 (makeBooleanGroupAction.enabled), :76 (run)
- scenario: select two shapes, one locked (own flag or locked layer/group), whose world pose lands as a different local pose under the new group's site (or with `shift` moving them onto a page, or a follower on a locked node) → `enabled` answers true and `run` commits `reparent` + `setPose` ops on the locked node, which the scene's lock guard refuses (the Group action used to throw from the scene for exactly this). Per the 2026-11-22 ruling for Group (unruled.md:423) it should be disabled with `ActionDisabledReason.Locked` and `run` should write nothing; neither `writesLocked`/`opsAnswer` nor `anyLocked` is consulted anywhere in this file.
- evidence: read (compared with unruled.md 2026-11-09 / 2026-11-22 rulings and `lockedWrites.ts`)
- severity: medium

## Align, Distribute, Flip and Swap `enabled` ignore the transform followers their `run` commits through
- where: packages/editing/src/actions/align/action.tsx:99 (enabled), packages/editing/src/actions/distribute/action.tsx:84, packages/editing/src/actions/flip/action.ts:191, packages/editing/src/actions/swap/action.ts:47
- scenario: a canvas with a `transformFollowers` dep whose follower refuses the batch (`finish` returns null) or adds ops writing a locked follower node → `enabled` runs `opsAnswer` on the unfinished ops and answers `true`, but `run` goes through `commitTransformOps` / `createTransformCommit`, which finishes them first and commits nothing (or is refused by the lock guard). Transform Again answers the same question correctly via `finishTransformOps` (`transformSelection.ts:35`), so the decision is answered two ways; the 2026-11-10 ruling requires `enabled` to ask the question `run` answers.
- evidence: read (`transformFinish.ts:53-73`)
- severity: medium

## Transform Again on a rotate with a locked source answers NotApplicable, not Locked
- where: packages/editing/src/actions/rotate/session.ts:144 (captureTurn) via packages/editing/src/actions/rotate/replay.ts:20 and packages/editing/src/actions/transformAgain/transformSelection.ts:33
- scenario: last transform was a rotate; select a node that is locked (or a group with a locked source) → `captureTurn` returns null for the lock, `rotateSelectionOps` returns `[]`, and `selectionTransformAnswer` reports `NotApplicable`, whereas a repeated move/scale of the same selection reports `Locked` through `opsAnswer`. The menu says "nothing to do" instead of "Contains a locked item" (ruled 2026-11-09: commands that would rewrite a locked node are disabled with `Locked`).
- evidence: read
- severity: low

## A clone drag whose behavior claims the commit with no ops is recorded as a duplicate
- where: packages/editing/src/actions/clone/action.ts:128 (commitClone), :229 (onEnd)
- scenario: a clone behavior's `onEnd` answers `[]` (claims the commit, makes nothing) → `commitClone` returns `true` (`answer.length === 0 || …`), so `onEnd` calls `recordTransform(scene, { kind: 'duplicate', dx, dy }, selection.get())` with the originals still selected and `runBehaviorSettled(…, committed=true)`. The next Cmd+D (Transform Again) duplicates the originals by the drag offset although no copy was ever made; nothing should be recorded and settled should be told `false`.
- evidence: read
- severity: low

## Flip mirrors data-held geometry by the parent frame's rotation only, so a sheared/scaled frame mis-mirrors the data
- where: packages/editing/src/actions/flip/action.ts:33 (localMirror)
- scenario: a path inside a container whose `transform` (skew, or non-uniform scale) composes into its children (unruled.md:367) → the pose is flipped correctly through `frame.local`, but `localMirror` builds the local mirror as `R(θ)·M·R(-θ)` from the rebased pose's `rotation` alone, ignoring the frame's linear part (`at.transform`); for a non-rigid frame the world mirror in local coordinates is `L⁻¹·M·L`, not a rotated axis mirror, so the data reflects across the wrong line while the pose lands correctly — the exact mismatch the function's doc says it exists to prevent.
- evidence: read (inference about composition with a container `transform`; not run)
- severity: low

## Files read
packages/editing/src/actions/align/action.tsx
packages/editing/src/actions/align/align.ts
packages/editing/src/actions/align/index.ts
packages/editing/src/actions/clipboard/action.ts
packages/editing/src/actions/clone/action.ts
packages/editing/src/actions/clone/behaviors.ts
packages/editing/src/actions/delete/delete.ts
packages/editing/src/actions/derivedBox.ts
packages/editing/src/actions/distribute/action.tsx
packages/editing/src/actions/distribute/distribute.ts
packages/editing/src/actions/distribute/index.ts
packages/editing/src/actions/distribute/plan.ts
packages/editing/src/actions/flip/action.ts
packages/editing/src/actions/flip/helpers.ts
packages/editing/src/actions/group/enterGroup.ts
packages/editing/src/actions/lassoSelect/action.ts
packages/editing/src/actions/lassoSelect/behaviors/selectFromLasso.ts
packages/editing/src/actions/lassoSelect/index.ts
packages/editing/src/actions/lassoSelect/options.ts
packages/editing/src/actions/lockedWrites.ts
packages/editing/src/actions/pathfinder/action.tsx
packages/editing/src/actions/pathfinder/booleanGroupAction.ts
packages/editing/src/actions/pathfinder/keymap.ts
packages/editing/src/actions/reorder/reorder.ts
packages/editing/src/actions/rotate/action.ts
packages/editing/src/actions/rotate/commit.ts
packages/editing/src/actions/rotate/frame.ts
packages/editing/src/actions/rotate/replay.ts
packages/editing/src/actions/rotate/session.ts
packages/editing/src/actions/select/areaSelect.ts
packages/editing/src/actions/select/clearSelection.ts
packages/editing/src/actions/swap/action.ts
packages/editing/src/actions/swap/swapOps.ts
packages/editing/src/actions/transformAgain/action.ts
packages/editing/src/actions/transformAgain/transformSelection.ts

<!-- done: 5 findings, files read: 35 -->
