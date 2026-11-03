---
'@weasel-js/core': patch
---

A marquee or lasso over a scene with no pick index is about twice as fast: a 25% marquee over 10,000 rect nodes went from 0.85 to 0.42 ms (M3 Max, median of 8 interleaved runs each). While nothing in the scene is overridden, the walk reads each node's pose and path straight off the node; while something is, a node that derives no pose costs two override lookups instead of three. Which nodes a pick returns is unchanged.
