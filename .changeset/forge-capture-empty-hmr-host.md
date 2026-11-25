---
'@weasel-js/forge': patch
---

Captures work under `server.hmr` with an empty `host` or `protocol`, which now fall back to the page's own, as vite's client does.

<!-- entry: fix -->
