---
'@weasel-js/diagram': patch
---

`DiagramView`'s fit now takes in each edge's waypoints and stored route as well as its node and group boxes, so a wire routed around the nodes, past all of them, is no longer cut off at the canvas edge. `fitDiagram` changes the same way.
