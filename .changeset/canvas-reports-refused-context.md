---
'@weasel-js/core': patch
---

A canvas whose WebGL context the renderer cannot use now says so. The reason was swallowed, so a context opened without a stencil buffer (a bare `getContext('webgl2')` on a shared buffer before any pane painted) or a shader that failed to compile left every pane blank with an empty console, and the renderer was rebuilt and failed again on every redraw. The error is now logged once per canvas with `console.warn`, and the canvas is not retried.
