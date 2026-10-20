---
"@weasel-js/core": patch
---

`CANVAS_CONTEXT_ATTRIBUTES` is the WebGL2 context attributes a weasel canvas is opened with. A
context keeps the attributes of whoever opens it first and the renderer refuses one without a
stencil buffer, so anything that may open the canvas before its first paint, such as a pixel reader
or a tenant sharing the buffer, passes these.
