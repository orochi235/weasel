---
'@weasel-js/font': patch
---

The outline parser refuses a WOFF file whose table records a length its compressed data could not inflate to, before allocating it, and holds each inflated table only once while unpacking.

<!-- entry: fix -->
