---
'@weasel-js/pdf': patch
---

`writePdf` no longer rejects an export holding faked-bold text with no fill and a stroke whose dash is not finite.

<!-- entry: fix -->
