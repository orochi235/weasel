---
'@weasel-js/core': patch
---

A culled scene view walks only the parts of the scene that can reach the view: a frame costs what is on screen, not the whole scene.

With `cull` on and paint bounds known, a scene slot or scene view keeps, per node, the box its paint and its descendants' can reach, updated from `scene.changesSince` as nodes change; a container with many children indexes them, so a pan over a wide, flat scene skips the children off screen without visiting them. A subtree that cannot reach the view emits nothing, not even the empty per-node groups it used to.

<!-- entry: rank=15 perf behavior -->
