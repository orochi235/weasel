---
'@weasel-js/kernel3d': patch
---

kernel3d ships `POSE3_COMPOSITION`, a container composition for `Pose3`: a container's position, rotation and scale reach everything under it. It is exact when a container's scale is uniform; under a non-uniform one a turned child keeps its own axes rather than shearing.

Picking, the marquee, `screenBoxOf`, snap targets and what a move drags now read each node at its world pose, folded up through its containers, where they used to read the stored pose. A node inside a container was picked and snapped at its container-relative position before. Picking also follows a gesture's in-flight pose. A move's snap leaves out everything under the moved nodes, which moves with them.

`worldPoseOf(scene, id)` is new: the pose a renderer draws a node at. Additive API.

Behavior change: `NodeBounds` is handed the node at its world pose and may return `null` for a node that occupies nothing, which is then never picked or snapped to. With no `bounds`, a group now occupies nothing, where it used to be a unit cube carried by its pose.
