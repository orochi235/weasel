---
'@weasel-js/forge': patch
---

The forge dev server warns of each `capture.allowOrigins` entry it leaves out for not being a URL written as a string.

An entry needs its scheme: `'https://fonts.gstatic.com'`, not `'fonts.gstatic.com'`.

<!-- entry: fix -->
