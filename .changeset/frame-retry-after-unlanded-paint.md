---
'@weasel-js/core': patch
---

A canvas whose paint throws again, after a paint that returned without landing, retries it on the next frame instead of staying unpainted until something else asks for a redraw.

<!-- entry: fix -->
