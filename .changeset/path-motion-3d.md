---
'@weasel-js/kernel3d': minor
---

`pathMotion3(table, { descriptor })` moves a `Pose3` along a 3D path, as core's `pathMotion` does a 2D pose.

`table` is a three-component length table, such as `lengthTable3(points)` from `@weasel-js/geom/3d`. `orient` turns the node's local +x along the tangent with its +y toward `up` (default +y), after `rotationOffset`; `anchor` is the point in the node's own space that rides the path (default its origin). Not orienting, rotation slerps from one pose's to the other's. `tweenPose` with it as `geometry` writes the pose each frame.

<!-- entry: api new -->
