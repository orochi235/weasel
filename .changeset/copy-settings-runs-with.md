---
'@weasel-js/labkit': patch
---

Copy settings as JSON copies the values a trial runs with.

An auto field is copied at its resolved value, an endless number as `"Infinity"`, and a cleared one as `null`.

<!-- entry: fix -->
