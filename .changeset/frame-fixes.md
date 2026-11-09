---
'@weasel-js/core': patch
'@weasel-js/path-tools': patch
---

Paths inside a frame-defining group are read and written where they draw.

- Path commands (Cut at Crossings, Join, Simplify, Offset, Resample, Trim, Extend to Meet, Smudge, Warp, Girth) read a path stored inside a group in world, and store their result back in the group's frame. Before, they read it without the group's offset or turn, so Cut at Crossings found no crossing between a root path and one inside a group.
- Path edit draws a grouped path's anchors where the path is, and commits edits into its own frame.
- Path snapping and the outlines Trim and Extend stop at take a grouped node where it draws.
- A connector or other derived node inside a turned group is picked on the ink it paints, not turned a second time by the group's angle.

`PathNode` gains `shown` (the node at its world pose) and `local` (a world pose as the node stores it). `withPath`, `reshapeOps` and `pathCopy` now take the `PathNode` instead of its `node`, which breaks callers that passed the node. `withShownPath`, `nodeFrameOf`, `shownIn` and `shownNodeOf` are new. The `editAnchors` dep's `getNodeShape` answers the world pose, and a new optional `storedPose` turns a world pose back into the stored one.
