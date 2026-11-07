---
'@weasel-js/symmetry': patch
---

A symmetry group inside a frame, such as one on any page but the first, read and drew its center in the frame's coordinates while its copies turned about the world point: the guide sat in the wrong place, a handle drag measured its angle from there, and path edit kept a path symmetric about the wrong center. `readGroup`, `editSymmetries`, and the controller's `read`, `update`, `preview`, and `create` now take and give the center in the world, and store it in the group's frame. A caller of `create` that passed a center in the parent's frame now passes the world point.
