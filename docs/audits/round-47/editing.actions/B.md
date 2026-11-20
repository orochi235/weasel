# Audit round 47 — editing.actions

## A zero-area lasso selects through the default commit but acts as a click through `selectFromLasso`
- where: packages/editing/src/actions/lassoSelect/action.ts:215 (endLasso)
- scenario: a lasso drawn as a straight stroke (three or more collinear vertices, AABB area 0) or a tiny scribble under 4 world-px² runs the default commit, which only checks `vertices.length < 3`, so it hit-tests a degenerate polygon (in `'intersect'` mode the line can hit nodes it crosses) and replaces the selection with those hits. The same gesture with the `selectFromLasso` behavior (`selectFromLasso.ts:43`) is "tiny" by `polygonAabbArea < MIN_AREA` and clears the selection like a click. One question — when is a lasso a click — answered two ways; the default should apply the same area test.
- evidence: read
- severity: low

## Swap is enabled over an envelope holding a locked member, and its commit writes that member's pose
- where: packages/editing/src/actions/swap/swapOps.ts:101 (swapOps); gate at packages/editing/src/actions/swap/action.ts:17 (pairOf → `swappable`)
- scenario: a boolean group (or any envelope: `dependsOn: 'children'` with `derivePose`) is unlocked and selectable, and one of its operands is locked. Select it and a same-size node and run `swap`. `swappable` checks only `isLocked(a)`/`isLocked(b)`, and `isLocked` climbs ancestors, not descendants, so the pair is enabled. `moveEachOps` moves an envelope by moving its sources (`moveSources` → `translateTargets`), so the batch holds a `setPose` on the locked child, and `reframed` adds another for it when the parents differ; the scene's lock guard (`fieldEdits.ts:57`, `refuse(id, 'set the pose of')`) throws out of `run`. Per the 2026-11-09 ruling (docs/unruled.md:365) a command that would rewrite a locked node is disabled with `Locked`; swap should check what its ops write (e.g. `reachesLocked`-style over the move targets), not just the two ids.
- evidence: read (lock-guard throw read in `lockGuard.ts:52` / `fieldEdits.ts:57`; not run)
- severity: medium

## Flip, Align, Distribute and Rotate write the locked member of a selected envelope and are not disabled for it
- where: packages/editing/src/actions/flip/action.ts:81 (flipOps, `shapeSources`); packages/editing/src/actions/align/action.tsx:71 and packages/editing/src/actions/distribute/action.tsx:54 (`moveEachOps`); packages/editing/src/actions/rotate/session.ts:79 (captureOrigins)
- scenario: same state as above — a selected boolean group whose operand is locked. Flip reaches the operand through `shapeSources` and emits `setPose` (and a geometry-data op) for it; Align/Distribute reach it through `moveEachOps` → `moveSources`; Rotate's `captureOrigins` keeps every `shapeSources` id with no lock test, and its commit (`commitRotate` → `rotateOps`) writes it. None of their `enabled` gates looks at locks, so each is enabled and its run throws from the scene's lock guard (for rotate, inside `onEnd`). Resize refuses this case (`resize/session.ts:123`, ruled 2026-11-11, docs/unruled.md:257); these four answer the same question the other way. The `editActions.pbt` property test that asserts "never throws … no locked node moves" builds only stored-pose `kind: 'group'` containers, so it never reaches an envelope.
- evidence: read (inference from the lock guard and the write paths; not run)
- severity: medium

## Make Boolean Group is enabled for a selection spanning layers, then does nothing
- where: packages/editing/src/actions/pathfinder/booleanGroupAction.ts:92 (makeBooleanGroupAction.enabled)
- scenario: select two unlocked nodes on different layers. `enabled` only asks `requiresContent(2)` and `rootsAmong(...).length >= 2`, so the command shows enabled; `run` calls `booleanGroupOps`, which returns null when `new Set(nodes.map(n => n.layer)).size > 1` (line 31), or when an operand lands in a singular frame or `followerMoves` refuses, and nothing happens. The 2026-11-10 ruling (docs/unruled.md:373) requires `enabled` to ask the question `run` answers, and 2026-11-11 (docs/unruled.md:260) fixed exactly this cross-layer case for Group; `enabled` should be `booleanGroupOps(...) !== null`.
- evidence: read
- severity: low

## `transformSelection`'s doc tells callers to require `selection`, but it reads `operands`
- where: packages/editing/src/actions/transformAgain/transformSelection.ts:29 (transformSelection docstring)
- scenario: an action author follows the docstring and declares `requires: ['scene', 'selection', 'applyOps', ...]`. The dispatcher hands an action only the deps it declares ("an undeclared read is undefined", clipboard/action.ts:25), and `transformSelection` reads `deps.operands` (line 36), so it returns false and does nothing. The working callers (`packages/measure/src/measureCommands.ts:40,58`) declare `operands`; the doc should say `operands`.
- evidence: read
- severity: low

## A clone dropped into another container stores an envelope's children in the source's frame, not the new parent's
- where: packages/editing/src/actions/clone/action.ts:77 (placedCopyOps, the `placement === undefined || !isRoot` branch)
- scenario: Alt-drag a boolean group (an envelope, whose children are stored in its parent's frame, so they are in `originPoses` via `translateTargets`) and drop it where a clone behavior answers a `placement` under a container whose frame differs from the source's parent (e.g. a frame container with its own offset or turn). The copied root goes through `frame.localUnder(parent, world)`, but every non-root copy goes through `landed` → `scratch.frame.local(id, world)`, which expresses the world pose in the *source's* frame chain. The copies' children then sit under the new parent's frame with poses meant for the old one, so the copied group lands offset (or turned) by the difference between the two frames, and it also ignores the root's `placement.poses` pose, since an envelope's pose derives from those children. `swapOps` handles the same case by rewriting an envelope's children in the new parent's frame (`reframed`, swapOps.ts:49).
- evidence: read (not run)
- severity: medium

## A lone path-effect node with one source rotates about the source's center while the gesture orbits the effect's box
- where: packages/editing/src/actions/rotate/session.ts:151 (captureTurn, `useUnionPivot: ids.length > 1 && …`)
- scenario: select one node whose pose derives from a single named source (`derivedBoxOwner` non-null, `shapeSources` → one id) and whose box is not centered on that source. `captureTurn` sets `pivot` to the effect's own box center (line 144–150), and the pointer angle and rotate cursor are measured about it, but `useUnionPivot` is false because `ids.length === 1`, so `turnedWorlds` turns the source about its own center. The chrome turns about one point and the shape about another. Flip answers this case the other way: a stood-in member mirrors about the derived node's own box (flip/action.ts:82–87). The owner case should orbit `pivot` whenever `derivedBoxOwner` is non-null.
- evidence: read
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

<!-- done: 7 findings, files read: 34 -->
