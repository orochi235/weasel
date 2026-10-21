---
'@weasel-js/routing': patch
'@weasel-js/core': patch
'@weasel-js/diagram': patch
---

A dep source is handed `below`, which reads the source it displaced, in its own scope or one above, so a source can handle part of a dep and pass the rest to the default (`DepSource`, accepted by `useDepSource` and `DepRegistry.register`). A source taking no argument works as before. `useStencilInsert` uses it: a kind no stencil names goes to the `insert` dep beneath it, so core's rect, ellipse and text tools work beside stencils.
