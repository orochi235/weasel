---
'@weasel-js/core': patch
---

Cutting a closed path at an anchor (`openSubpathAt`, the "Cut path" action) removed the segment arriving at that anchor, so a cut triangle lost a side. The cut now leaves every segment and two coincident end anchors. `deleteAnchorsAt` also refits the closing segment when a closed subpath loses an anchor beside its seam, and no longer removes a neighbor when the same index is passed twice.
