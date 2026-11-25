# Findings: editing.actions.resize (round 47)

## A minimum set on one axis only stops every flip on the other axis, collapsing it to zero
- where: packages/editing/src/actions/resize/behaviors/clampMinSize.ts:14 (clampToMinSize), reached from packages/editing/src/actions/resize/frame.ts:106 (posesInBox) with packages/editing/src/actions/resize/minimum.ts:20,34 (boxMinimum)
- scenario: `minSizeOf` returns `{ width: 0, height: 20 }` for `data.minSize = { height: 20 }`; a shared box with a member whose leaf has zero height on an axis (ratio 0) gives the same sort of `{ width: >0, height: 0 }` minimum. Drag the east handle of such a node past its west edge: `movedEdges` gives a negative width, `anchor.x !== 'free' && width < 0` holds, so the width is set to 0. The node collapses to a zero-width sliver for the rest of the drag and commits that way instead of mirroring. The axis carries no minimum, so it should flip freely as it does when there is no `minSize` at all.
- evidence: read
- severity: medium

## Transform Again (resizeSelectionOps) does not hold a frame's contents in place, so the drag and the replay disagree about them
- where: packages/editing/src/actions/resize/replay.ts:41-42 (resizeSelectionOps), vs packages/editing/src/actions/resize/frame.ts:180 (nextFrame)
- scenario: Resize a node that defines a frame and stores children (not written themselves). The drag runs `holdInPlace`, so `previews` has each held child re-expressed and `resizeOps` writes a `setPose` for it, which leaves the children where they drew. Repeat the resize with Transform Again: `resizeSelectionOps` builds `previews` from `posesInBox` alone. No held id is in it, so `resizeOps` skips every held node (`previews.get(id) === undefined`), and the children are rescaled along with their frame. The same transform has two outcomes depending on whether it came from the drag or the replay.
- evidence: read
- severity: medium

## Transform Again of a resize skips the output-grid quantization the drag applies
- where: packages/editing/src/actions/resize/replay.ts:41 (resizeSelectionOps), vs packages/editing/src/actions/resize/frame.ts:176 (nextFrame)
- scenario: When the scene has an output grid, `nextFrame` runs every pose through `quantizedPreview(scene, id, pose, anchor)`. Its comment says the grid "is the invariant". `resizeSelectionOps` commits `posesInBox`'s raw poses with no quantization, so a resize repeated by Transform Again (or any caller of the command path) lands off the grid that the original drag snapped to.
- evidence: read
- severity: medium

## The recorded repeatable resize is the pre-quantization box, and is still recorded when a constraint's onEnd replaced the commit
- where: packages/editing/src/actions/resize/action.ts:68-71 (onEnd)
- scenario: (a) With an output grid, the committed poses are quantized, but `recordTransform` stores `unitsOfBox(box.bounds, frame.proposed)` from the unquantized `proposed`, so Transform Again repeats a proportion the user never got. (b) When a constraint's `onEnd` answers its own ops (`reduceBehaviorEnd` returns an array), `commitResize` commits those and returns true. The action still records `frame.proposed` as the transform, so Transform Again replays the box the pointer asked for, not what the constraint committed.
- evidence: read
- severity: low

## Files read
packages/editing/src/actions/resize/action.ts
packages/editing/src/actions/resize/aspect.ts
packages/editing/src/actions/resize/behaviors/clampMinSize.ts
packages/editing/src/actions/resize/behaviors/index.ts
packages/editing/src/actions/resize/boxFrame.ts
packages/editing/src/actions/resize/capture.ts
packages/editing/src/actions/resize/commit.ts
packages/editing/src/actions/resize/frame.ts
packages/editing/src/actions/resize/held.ts
packages/editing/src/actions/resize/index.ts
packages/editing/src/actions/resize/minimum.ts
packages/editing/src/actions/resize/replay.ts
packages/editing/src/actions/resize/ruleBounds.ts
packages/editing/src/actions/resize/session.ts

<!-- done: 4 findings, files read: 14 -->
