## A sweep never travels to the release point, so items between the last move and the release are not entered
- where: packages/routing/src/interactions/sweep/sweep.ts:146 (createSweepAction, start → onEnd)
- scenario: the pointer moves to a cell edge, and pointerup arrives a few pixels further over the next cell (pointerup coordinates differ from the last pointermove, which happens with coalesced or throttled moves). `onEnd` calls only `run.end(how)` and ignores `ctx.world`, so the cell under the release is never entered even though the pointer was let go on it. `onEnd` should `travel(ctx.world)` before ending on a commit.
- evidence: read
- severity: low
- size: line
- cause: end ctx point ignored
- confidence: likely

## Sweeping off an item onto a gap and back onto it does not enter it again, which contradicts its own doc
- where: packages/routing/src/interactions/sweep/sweep.ts:122 (reach)
- scenario: the user presses toggle A, drags into the gap beside it, then drags back onto A. `reach` returns early on a null item without resetting `current`, so the return to A matches `current` and `enter` is not called. `SweepRun.enter`'s doc says it is "called whenever the item under the pointer changes, so an item swept back over is entered again". Either a gap should clear `current`, or the doc should say that gaps do not count as a change.
- evidence: read
- severity: low
- size: line
- cause: gap does not clear current item
- confidence: likely

## An `overflow: clip` ancestor is taken as the scroller a sticky box sticks in
- where: packages/routing/src/interactions/handleDrag/handleDrag.ts:92 (scrollersOf)
- scenario: a sticky `rectEl` (or a sticky ancestor of it) sits inside a box with `overflow: clip`, which is inside a real scroll container. `styleOf(p)?.overflow !== 'visible'` treats the clip box as the sticky scroller. It then reads the sticky offset relative to a box that never scrolls, and goes on to add the real scroller's full scroll offset with `scrollerOf`. A scroll during the drag therefore shifts the local coordinates by the whole scroll distance while the box stays stuck on screen. The check should also exclude `clip` (and test each axis's overflow), since `clip` does not make a scroll container.
- evidence: read
- severity: low
- size: line
- cause: clip treated as scroll container
- confidence: likely

## Files read
packages/routing/src/interactions/browserReservedKeys.ts
packages/routing/src/interactions/carry/carry.ts
packages/routing/src/interactions/carry/index.ts
packages/routing/src/interactions/elementAt.ts
packages/routing/src/interactions/handleDrag/handleDrag.ts
packages/routing/src/interactions/keyHelpers.ts
packages/routing/src/interactions/pointerSession/index.ts
packages/routing/src/interactions/pointerSession/pointerSession.ts
packages/routing/src/interactions/pointerSession/swallowClick.ts
packages/routing/src/interactions/scratchKey.ts
packages/routing/src/interactions/sweep/index.ts
packages/routing/src/interactions/sweep/sweep.ts
packages/routing/src/interactions/thresholdDrag/index.ts
packages/routing/src/interactions/thresholdDrag/thresholdDrag.ts

<!-- done: 3 findings, files read: 14 -->
