---
'@weasel-js/forge': patch
---

Pixels refuses a fractional capture box whose rounded-up size would pass Chromium's 16384-device-pixel limit, rather than capturing past it.

<!-- entry: fix -->
