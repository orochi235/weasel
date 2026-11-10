---
"@weasel-js/stroke": patch
---

`strokeEdgeNear` measures a path measured from an `origin` where its line is. It compared the query point against the path's offsets as if they were coordinates, so the width tool found no edge, or the wrong one, on such a path, and an inner or outer stroke read its inked side off the wrong point.
