---
'@weasel-js/core': patch
---

The platformer demo's eleven bones are a parented chain in the scene tree, composed by `RIGID_POSE_COMPOSITION`, instead of eleven parentless nodes re-derived from world matrices every frame. `syncScene` writes local poses and resolves nothing; the joint hierarchy and the node hierarchy are now the same tree, which is what the scene-as-frame work was for.

The rig is rigid — every joint's `scaleX`/`scaleY` is 1 at bind and no clip touches either — so nothing had to stay flattened on the grounds the design doc excludes. The one term `RectPose` could not carry is the facing mirror, which was a `scaleX: -1` above the whole rotated chain. Mirroring a rigid chain is equivalent to negating every local rotation and every local x offset, so it moves into the pose data and stays exact.

A bone with children has to be a container, and a container with no `clipFromPose` clips its descendants to its own silhouette — a box a few units wide, here. The bone containers return `null`, which is how a frame says it groups without clipping.
