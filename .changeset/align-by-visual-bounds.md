---
'@weasel-js/core': patch
---

Align, distribute and flip use visual bounds

These folded each member's unrotated pose box, so "Align Left" on a selection
containing a rotated shape lined up the boxes and left the rotated shape's ink
sticking out past the others. They now work on the visual bounding box, as
Figma and Illustrator do.

Both ends moved together — expanding only the union would have made alignment
worse, since the delta runs from an edge of the union to the same edge of each
member's box. The new exported `visualBoundsViaDescriptor(pose, geometry)`
reads a pose's bounds, recovers its rotation and expands via
`axisAlignedBounds`; the union folds those with `unionAABB`. The delta is still
applied as a translation of the stored pose through
`translatePoseViaDescriptor`, so a shape moves rather than being re-posed.

Flip needed only its union pivot changed: mirroring maps a centre and preserves
size, and an expanded box is concentric with the box it came from.

`alignMoveBehavior` folds the dragged selection the same way, so a drag snaps
by its ink. Two known gaps remain on that axis: `deriveAlignmentGuides` still
advertises a stationary rotated sibling's guides at its unrotated edges, and
`useDistribute`'s `gaps` mode still divides by unrotated sizes (`defaults`
hardcodes `centers`, so only the hook reaches it).
