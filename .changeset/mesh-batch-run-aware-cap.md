---
'@weasel-js/core': patch
---

How big a mesh may be and still join a draw batch now depends on whether a batch is open when it arrives: up to 1,024 vertices when one is, and up to 96 when none is, where it used to be 256 either way. A mesh among rects or other batched fills draws with them far more often, and back-to-back meshes between 96 and 256 vertices draw on their own.
