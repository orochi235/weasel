---
"@weasel-js/core": minor
---

Group resize scales a rotated child along its own axes.

Resizing a group applied the group's per-axis scale straight to each leaf's
axis-aligned `width` and `height` and carried `rotation` through untouched.
That is correct when `src`/`dst` are already in the leaf's own frame — the
single-leaf path, where the drag delta is projected into that frame before the
anchor math runs — but in a group they are world-frame, and a rotated leaf's
local axes are not the axes being scaled. At 90° a horizontal stretch grew the
leaf's `width`, when its world-horizontal extent is its `height`.

New `remapRotatedLeaf(pose, src, dst)` in `interactions/actions/resize/geometry`
applies the group affine to the leaf's local frame and drops the shear, which
the `{x, y, width, height, rotation}` pose model cannot represent. The centre
moves exactly; each local axis takes the length of its own image; the rotation
follows the image of the local x-axis. `resizeAction` uses it on the group path
for any leaf with a rotation, and nowhere else — the unrotated leaf and the
single-leaf path are byte-identical to before.

Rotation and `width` compose exactly under repeated application; only `height`
drifts, since the perpendicular of a mapped axis is not the image of the
perpendicular — that gap is exactly the dropped shear. It does not accumulate
during a drag: every move remaps from the gesture's start poses, not from the
previous preview.
