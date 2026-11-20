## A live run restarted onto a planner leaves the cancelled run's eased edge paths on the override channel
- where: packages/diagram/src/live.ts:231 (restart), with packages/diagram/src/liveRoutes.ts:244 (useEasedRoutes.set)
- scenario: Take `useLiveLayout({ algorithm: someAsyncPlanner })` in the middle of a run, so `eased.show` holds a path override on each laid-out edge. A node is added. The reheat subscription (live.ts:245) calls `restart()`, which runs `pending.drop()` and then `run.cancel()`. `usePoseRun.cancel` (core usePoseRun.ts:195) halts and releases the node overrides, so the nodes snap back to their document poses, but it never calls `onCommit`. Only three things drop the path overrides: `eased.set` (inside `install`), `eased.drop()` (from `onCommit` or the handle's `cancel()`, live.ts:256), and unmount. `restart` reaches none of them, because `build()` returns false while the planner's answer is pending. Until the answer arrives, edges are drawn along routes eased toward the abandoned plan and no longer meet their nodes. If the planner rejects, or the answer is dropped because the graph changed again (`sameGraph` false, live.ts:218), `install` never runs and the stale paths stay until unmount or the next run. A step that throws ends the same way: `stepOrElse` halts and releases, and `eased` is never dropped. `restart` should drop the eased routes the way `cancel()` does.
- evidence: read
- severity: medium

## The spec label placer's cache key leaves out `inset`, so changing only a label's inset reuses stale placements
- where: packages/diagram/src/labels/specLabels.ts:48 (keyOf)
- scenario: `candidatesOf` (labels/place.ts:131) builds the preferred candidate with the label's `inset`. `labelCenter` (labels/station.ts:77) then moves a `'start'`/`'end'` label along the route by that inset, so `inset` changes the box that `costOf` scores. `keyOf` keys each label on `at`, `offset`, `dodge` and its size, but not on `inset`. Suppose a host feeds the placer specs that differ only in one label's inset, e.g. `{ at: 'end', inset: 4 }` becomes `{ at: 'end', inset: 20 }`. The placer returns the cached `last.placed`, so the label's `placed` spot is still the one scored at the old inset. It can push the label off a preferred station that is now clear, or leave it on one a shape now covers.
- evidence: read
- severity: low

## Files read
packages/diagram/src/faceCapCenter.ts
packages/diagram/src/faceRemeasure.ts
packages/diagram/src/firstSight.ts
packages/diagram/src/footprint.ts
packages/diagram/src/force.ts
packages/diagram/src/forceClusters.ts
packages/diagram/src/fromData.ts
packages/diagram/src/graph.ts
packages/diagram/src/grid.ts
packages/diagram/src/headerClick.ts
packages/diagram/src/icons.gen.ts (head and tail only; generated)
packages/diagram/src/icons.table.ts
packages/diagram/src/imageRelease.ts
packages/diagram/src/index.ts
packages/diagram/src/itemDrop.ts
packages/diagram/src/itemDropTarget.ts
packages/diagram/src/keyedIndex.ts
packages/diagram/src/label.ts
packages/diagram/src/labelCommands.ts
packages/diagram/src/labelDragLayer.ts
packages/diagram/src/labelTrait.ts
packages/diagram/src/labels/fit.ts
packages/diagram/src/labels/install.ts
packages/diagram/src/labels/labels.bench.ts
packages/diagram/src/labels/place.ts
packages/diagram/src/labels/specLabels.ts
packages/diagram/src/labels/station.ts
packages/diagram/src/labels/useLabelPlacement.ts
packages/diagram/src/layered.ts
packages/diagram/src/layout.entry.ts
packages/diagram/src/layout.ts
packages/diagram/src/layoutAction.ts
packages/diagram/src/layoutFixture.ts
packages/diagram/src/layoutFrame.ts
packages/diagram/src/live.ts
packages/diagram/src/liveFixture.ts
packages/diagram/src/livePlan.ts
packages/diagram/src/liveProducers.ts
packages/diagram/src/liveRoutes.ts
packages/diagram/src/marks.ts
packages/diagram/src/mirrorSelection.ts
packages/diagram/src/moveLabelAction.ts
packages/diagram/src/offPage/endBox.ts
packages/diagram/src/offPage/follow.ts
packages/diagram/src/offPage/install.ts
packages/diagram/src/offPage/pagedFixture.ts
packages/diagram/src/offPage/split.ts
packages/diagram/src/offPage/tag.ts
packages/diagram/src/offPage/trait.ts
packages/diagram/src/offPage/useOffPageMarkers.ts

Notes: I couldn't save this to `.skulk/out/findings.md` because the write needed approval, so the whole document is here. I also couldn't run `git log` (that needed approval too), so I didn't use last-week history to focus the review.

<!-- done: 2 findings, files read: 50 -->