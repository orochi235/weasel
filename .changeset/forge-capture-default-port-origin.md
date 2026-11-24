---
'@weasel-js/forge': patch
---

Pixels takes a capture request from forge's own page when the dev server runs on port 80 or 443, where the browser's `Origin` names no port.

<!-- entry: fix -->
