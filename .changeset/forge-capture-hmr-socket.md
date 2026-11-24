---
'@weasel-js/forge': patch
---

Pixels captures on a dev server whose `server.hmr` sets its own port, host, or protocol, instead of closing vite's HMR socket and reloading the page mid-capture.

<!-- entry: fix -->
