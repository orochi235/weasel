---
'@weasel-js/renderer': patch
---

A group's effects now run in a buffer covering what the group paints, grown by how far its effects reach, rather than one the size of the drawing buffer. Content just past the edge of the canvas is drawn into it, so a blur or shadow of a shape lying off the canvas now reaches in across the edge, where before it was missing. A small blurred group runs its passes over its own rect, not the whole canvas. Effects that do not set `reach`, and composites that change pixels outside their group (`destination-in`, `copy` and the like), still run over the whole canvas. A retained layer holding a group whose effects set `reach`, an isolated group or a composite group now follows a pan like any other retained layer. Effect buffers are pooled by size, and a size no group used in a frame is freed at the start of the next.
