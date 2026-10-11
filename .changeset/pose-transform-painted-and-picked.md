---
'@weasel-js/core': patch
'@weasel-js/svg': patch
---

A box pose's `transform` (a `PoseLinear`: a skew or per-axis scale applied about the box center, inside the rotation) is now drawn and picked. The per-node render wrap, paint culling, painter silhouettes, `axisAlignedBounds`, `unionAABB`, `visualBoundsViaDescriptor`, `poseContainsRotated`, and region picking all read the pose through `poseFrameOf`, and `pathThroughPoseFrame` is the path form of it. `svgNodesToKitDrafts` carries a text or image node's `transform` onto the pose and `svgLeafFromKit` carries it back, so `<text transform="scale(4 1)">` imports as editable text drawn four times as wide. Selection chrome and the resize, rotate, and flip actions still work the unstretched box.
