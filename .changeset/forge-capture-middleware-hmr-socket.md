---
'@weasel-js/forge': patch
---

A Pixels capture keeps vite's HMR socket open under `server.middlewareMode` or a socket set in `server.ws`. The page no longer reloads mid-capture.

<!-- entry: fix -->
