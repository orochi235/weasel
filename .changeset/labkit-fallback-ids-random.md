---
'@weasel-js/labkit': patch
---

Two tabs of a lab opened outside a secure context no longer mint the same trial or snapshot id. The fallback used where `crypto.randomUUID` is missing, such as on a LAN address, now carries random bits.

<!-- entry: fix data -->
