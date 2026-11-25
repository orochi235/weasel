snapToContainer gave followers a group id where a page id was expected (A+B): fixed f020f3ad71. `buildGestureContext`'s `followerOps` now maps each landed parent to its page before calling `followerOpsFor`. Before, a follower of a node snapped into a group on its own page was moved into the page run.

A layout drop moves an envelope's descendants by a pose difference taken across two frames (A): not a defect. This is the reviewer's own scenario, an envelope dropped into a layout container turned a quarter. `move.layoutDropEnvelopeTurned.test.ts` covers it, and it passes at this commit: the members land in the slot, rotation included.

reparentOnDrop `'into'` raises a node to the top of its stack when it lands in the parent it already has (A+B): fixed 025819b73c. `landAbove` keeps the node's index when there is no sibling to land above, which also covers page drops. I made this call myself and recorded it in `docs/unruled.md`.

Overrides posted through the gesture adapter's `previewPoses` survive the gesture (A): not a defect. The adapter's doc says it serves behaviors "while the gesture runs and after it ends", and momentum's `coastByWrite` previews after release and clears its own entries. Clearing them when the drag ends would cut a flick's coast short, so whichever behavior posts a preview clears it.

clampMove ignores the rotation and transform of its bounds (B): fixed 84e80f7e56. It now clamps in the bounds' own frame. I fixed the same mistake for a rotated or transformed dragged node, now measured by the box it draws. Bounds with a singular transform hold the nodes where they started. That is my call, recorded in `docs/unruled.md`. The same commit also carries the paint-order entry there.

Extra:
- swapOps gave followers parent ids where page ids were expected (sweep): fixed 6fca919474. Swapping two nodes on one page, one of them in a group, moved a follower of the other into the page run.

Checks:
- `npx vitest run --maxWorkers=1`, one file at a time: `move.pages.test.ts` 27 passed; `move.reparentOps.test.ts` 7 passed; `move.reparentOnDropBehavior.test.ts` 4 passed; `move.reparentSubtree.test.ts` 5 passed; `move.reparentCaught.test.ts` 2 passed; `move.reparentEndCtx.test.ts` 3 passed; `move.reparentJournal.test.ts` 1 passed; `move.layoutDropEnvelopeTurned.test.ts` 1 passed; `behaviors/clampMove.test.ts` and `clampMove.frames.test.ts` 7 passed; `behaviors/snapToContainer.test.ts` 15 passed; `move.snapToContainerDerived.test.ts` 1 passed; `move.swapOnDrop.test.ts` 11 passed; `swap/swapOps.test.ts` 4 passed; `swap/action.test.ts` 5 passed. Every new test failed before its fix.
- `npm run check:changesets`: OK.
- `npm run checks:gate`: "checks:gate: all 33 passed".
- `npm run lint -w packages/editing`: fail ("Missing script"). The package has no lint script; only `build` and `test`. The root `npm run lint` passed inside the gate.
- Tree clean, `.skulkr/` untouched.

tally: 3 of 5 fixed, 1 extra fixed