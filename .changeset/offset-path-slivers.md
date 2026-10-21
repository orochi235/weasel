---
'@weasel-js/geom': patch
'@weasel-js/stroke': patch
---

`trianglesToPath` joins a vertex lying on another triangle's edge into that edge before the union, so a mesh whose float32 vertices sit a hair off their neighbors' edges no longer leaves cracks. A stroke ribbon puts a join's pivot on its segments' ends, so `strokeToPath` and `offsetPath` answered hairline slivers beside every curve: `offsetPath` of a square with a round corner, grown by 10, gave six subpaths instead of one, and grown by the corner's radius it ran a spike into the interior. A 2,000-point zigzag stroked 6 wide, which made polygon-clipping throw ("Unable to find segment"), now outlines too.
