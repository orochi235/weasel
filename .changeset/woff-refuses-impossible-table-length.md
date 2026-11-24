---
'@weasel-js/font': patch
---

The outline parser refuses a WOFF table recording a length its compressed data could not inflate to, before allocating it.

It also holds each inflated table only once while unpacking.

<!-- entry: fix -->
