# Audit round 42 — core.interactions.actions.part1

## commitOps reads `deps.operands` on the scene fallback even when no `select` was asked, throwing in dev for actions that never declared it
- where: packages/core/src/interactions/actions/defaultCommitAdapter.ts:84 (commitOps)
- scenario: an action that commits without `select` and does not list `operands` in `requires` — e.g. path-tools' spiro kind command (`packages/path-tools/src/spiro/spiroCommands.ts:67`, requires `['editAnchors','scene','applyOps']`, calls `commitOps(deps, ops, …)` at :73) — runs on a canvas with no consumer `applyOps` (the dep is optional, `engineDeps.ts:236`). With `select` undefined, `operands` is undefined, so line 84 evaluates `deps.operands`; the dev-build deps Proxy (`packages/routing/src/interactions/actions/buildDeps.ts:29`) throws "read deps.operands but did not declare it", and the edit never lands in dev. Line 68's own comment says the read is meant to happen only when needed. Should pass `operandMethods(operands)` (or read `deps.operands` only when declared).
- evidence: read
- severity: medium

## `swappable` lets a cross-parent swap land a node in a container `childVerdict` would refuse it
- where: packages/core/src/interactions/actions/canSwap.ts:37 (swappable)
- scenario: `childVerdict` (admitsChild.ts:38) calls itself "the one rule for whether `parent` takes `ids` as children, by drop, insert or paste", and a swap of nodes under different parents reparents each into the other's parent (`swapOps` → `landOps`). With no `canSwap` dep, `swappable` checks kind and size only, never `childVerdict`/`canDropInto`. A host whose `canDropInto('frameX', ['r1'])` answers false (or a `DropRefusal`) still gets `r1` placed inside `frameX` when the user swaps `r1` with a same-kind, same-size rect already in `frameX` — via the `swap` command or a `swapOnDrop: 'dwell'` drop — while a plain drop of `r1` onto `frameX` is refused. Likewise a follower whose followed nodes are on page 1 can be swapped onto page 2, which `childVerdict`'s page rule refuses. The default should also require `admitsChild(scene, parentOf(b), [a], canDropInto)` and the converse when the parents differ.
- evidence: read
- severity: medium

## `moveEachOps` moves a node twice when one entry carries it in a container's frame and a later entry names it
- where: packages/core/src/interactions/actions/moveNodes.ts:94-98 (moveEachOps)
- scenario: the doc (line 80) promises "A node two entries reach takes the first one's delta". `claimed` holds only each entry's `translateTargets`, which leaves out descendants carried by a moving frame. `moveEachOps(scene, [{ ids: ['C'], dx: 10, dy: 0 }, { ids: ['K'], dx: 5, dy: 0 }])`, with `K` a child stored in container `C`'s frame: entry 1 writes only `C` (K is carried, not claimed), entry 2 finds `K` unclaimed and writes it too, so `K` ends 15 from where it was instead of 10. The kit's align and distribute pre-filter with `uncarried`, but the function is a public export (`@weasel-js/core`) whose contract says otherwise. Claiming the whole moving subtree (or skipping a target with an ancestor already in `claimed`) would hold the promise.
- evidence: read
- severity: low

## `childVerdict` holds the follower page rule only for a page itself, not for a container on that page
- where: packages/core/src/interactions/actions/admitsChild.ts:54 (childVerdict)
- scenario: `own` is computed only when `target.page !== undefined`, so the check that a follower lands only on the page everything it follows is on runs for a drop onto the page node and is skipped for a drop into a group nested on that page. A connector following two shapes on page 1, dropped onto page 2 itself, is refused; dropped into a group on page 2, it is admitted (falling through to `canDropInto`/kind), landing it on page 2 against the rule `followerLandings` states. Computing `own = pageIdOf(scene, parent)` for every parent outside the run would answer both alike.
- evidence: read
- severity: low

## Files read
packages/core/src/interactions/actions/actionGroups.ts
packages/core/src/interactions/actions/actionParamSchema.ts
packages/core/src/interactions/actions/actionParams.extension.fixture.ts
packages/core/src/interactions/actions/actionParams.typetest.ts
packages/core/src/interactions/actions/admitsChild.ts
packages/core/src/interactions/actions/canSwap.ts
packages/core/src/interactions/actions/defaultCommitAdapter.ts
packages/core/src/interactions/actions/depSchema.ts
packages/core/src/interactions/actions/drawnBoxes.ts
packages/core/src/interactions/actions/dropVerdict.ts
packages/core/src/interactions/actions/duplicateOffset.ts
packages/core/src/interactions/actions/edit-anchors/geometry.ts
packages/core/src/interactions/actions/edit-anchors/params.ts
packages/core/src/interactions/actions/editAnchorsDep.ts
packages/core/src/interactions/actions/editDeps.ts
packages/core/src/interactions/actions/engineDeps.ts
packages/core/src/interactions/actions/finiteFrame.ts
packages/core/src/interactions/actions/followerMoves.ts
packages/core/src/interactions/actions/geometryProjection.ts
packages/core/src/interactions/actions/gestureFrames.ts
packages/core/src/interactions/actions/groupSlot.ts
packages/core/src/interactions/actions/hitSelection.ts
packages/core/src/interactions/actions/ingestionDeps.ts
packages/core/src/interactions/actions/insertDeps.ts
packages/core/src/interactions/actions/layoutDeps.ts
packages/core/src/interactions/actions/magnification.ts
packages/core/src/interactions/actions/moveNodes.ts

<!-- done: 4 findings, files read: 27 -->
