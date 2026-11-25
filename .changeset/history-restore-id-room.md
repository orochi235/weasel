---
'@weasel-js/history': patch
---

`History.restore` refuses a snapshot whose ids lie beyond ±2^52, so entries recorded after it never share an id.

<!-- entry: fix data -->
