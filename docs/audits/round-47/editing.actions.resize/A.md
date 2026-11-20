# Audit round 47 — editing.actions.resize

## Shift on an edge handle shrinks the free axis past `data.minSize`, and a clamp then breaks the aspect
- where: packages/editing/src/actions/resize/frame.ts:171 (nextFrame) with packages/editing/src/actions/resize/frame.ts:106 (posesInBox) and packages/editing/src/actions/resize/behaviors/clampMinSize.ts:14 (clampToMinSize)
- scenario: `edgeAspect` rescales the axis an edge handle leaves `free` to keep the aspect, but `clampToMinSize` skips every `free` axis (it assumes a drag leaves that extent alone). A 100×100 rect with `data.minSize` 50×50, bottom-edge handle (`anchor {x:'free', y:'min'}`), Shift held, dragged up to height 20: `edgeAspect` gives 20×20, the clamp raises only the height to 50, so the preview and commit are a 20×50 box — under the minimum on x and off the aspect Shift promised. A 200×100 rect with minSize width 150 dragged with Shift to height 40 commits width 80 with no clamp at all. Should hold both axes to the minimum (and keep the aspect) when the aspect lock moves the free axis.
- evidence: read
- severity: medium

## Resizing by command (Transform Again) does not hold a frame's children in place, which the drag does
- where: packages/editing/src/actions/resize/replay.ts:41 (resizeSelectionOps)
- scenario: under a composing pose strategy, a node that defines a frame and has stored children: the drag's `nextFrame` runs `holdInPlace` so each child is re-expressed in the frame's new pose and draws where it was (`held.ts` header: "a resize changes the box, not where the contents draw"). `resizeSelectionOps` calls `posesInBox` and goes straight to `resizeOps`; `posesInBox` never adds held ids, so `resizeOps`' held loop finds no preview for any of them and writes nothing. Repeating that same resize with Cmd+D (`transformSelection` → `resizeSelectionOps`) scales and moves the children with the frame. The command path still refuses to start when a held child is locked (`captureResize`), though it never rewrites it. Same decision, two answers; should run `holdInPlace(previews, place.held, place.poseFrame)` as the drag does.
- evidence: read
- severity: medium

## A flipped lone node with a minimum unflips and jumps on the first move
- where: packages/editing/src/actions/resize/frame.ts:106 (posesInBox) via packages/editing/src/actions/resize/behaviors/clampMinSize.ts:14; packages/editing/src/actions/resize/minimum.ts:27 (boxMinimum)
- scenario: the rect descriptor's `getBounds` is `p => p`, so a pose stored with signed extents (which `commit.ts` keeps on purpose without a geometry projection: "a bare-AABB pose is the only carrier of the flip") gives `box.bounds.width < 0`. For a lone node `{x:100, width:-50, …}` with `data.minSize.width 10`, any 1 px drag gives width −49 < 10, so `clampToMinSize` sets width to +10: the node snaps from [50,100] to [100,110] and loses its flip. In a shared box the same flipped member is instead ignored (`leaf.width > 0 ? … : 0`), so the minimum is answered two ways for one pose. Should compare magnitudes (or the box's own sign) rather than the signed width.
- evidence: read
- severity: low

## Transform Again records the dragged box even when a constraint's `onEnd` committed something else
- where: packages/editing/src/actions/resize/action.ts:68 (onEnd)
- scenario: `commitResize` returns `commitRunOps(target, lifecycle, r)` when `reduceBehaviorEnd` answers with ops of its own, and `committed` is true. `onEnd` then records `unitsOfBox(session.box.bounds, frame.proposed)` — the last move's box — as the transform to repeat, although what reached the document was the constraint's ops. Cmd+D then repeats a scale the user never got. Should only record when the frame's own ops were committed (or record from what was committed).
- evidence: read
- severity: low

## A projected frame's normalized pose leaves its held children posed for the flipped one
- where: packages/editing/src/actions/resize/commit.ts:54 (resizeOps) with packages/editing/src/actions/resize/commit.ts:34 (projectedGeometry)
- scenario: a written node that both defines a frame with held children and has data-held geometry the projection answers for, dragged past its opposite edge: `holdInPlace` posed the children against the signed preview pose, but `projectedGeometry` swaps the frame's committed pose for the normalized `nb`. The held children's `to` (computed in the first loop from `previews`) is not recomputed against `nb`, so after commit the children no longer draw where the preview held them (mirrored/offset by the flip). Should derive held poses from the pose actually committed for their frame.
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

<!-- done: 5 findings, files read: 14 -->
