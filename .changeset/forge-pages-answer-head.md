---
'@weasel-js/forge': patch
---

The workshop's dev server answers a HEAD request for its pages with the same status and headers as a GET, so link checkers and health checks see 200 rather than 404.

<!-- entry: fix -->
