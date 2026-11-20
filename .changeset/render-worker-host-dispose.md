---
'@weasel-js/core': minor
---

`hostSceneRender` and `serveSceneRender` return a function that stops the host. A worker hosting several ports asks each page in turn for an image only a page can load.

<!-- entry: api fix -->
