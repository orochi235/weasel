---
"@weasel-js/core": patch
---

`alignResizeBehavior` now snaps a rotated node by where its corners are drawn.
Before, it matched the node's unrotated box, so on a rotated node it snapped to
lines nothing visible was near and missed the ones the handle was on. A corner
handle now snaps the dragged corner to guides on both world axes; an edge
handle slides its edge along the node until one of its two corners meets a
guide. Unrotated nodes snap exactly as before.

It takes an optional `poseDescriptor` (its options are now `AlignMoveArgs`),
used to read the node's box and rotation; pass the same one the resize action
uses when your poses are not rect-shaped.
