---
'@weasel-js/svg': patch
'@weasel-js/core': patch
---

`parseSvg` keeps the skew or per-axis scale of a `<text>` or `<image>` instead of warning and dropping it, and `serializeSvg` writes it back. `SvgTextNode` and `SvgImageNode` gain a `transform` field for it, a `PoseLinear`: the part of the element's transform its box, rotation, and flips cannot hold, applied about the box center inside the rotation. An image that is rotated and scaled by axis, or rotated and mirrored, now imports exactly as a box, a rotation, and a flip. Core gains `PoseLinear`, `RectPose.transform`, and `poseFrameOf` / `poseFrameInverseOf` / `poseLinearOf`, the one composition of a box pose's rotation and `transform` into a matrix; nothing in core paints or picks through it yet.
