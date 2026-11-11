---
"@weasel-js/font": patch
---

`registerFontOutlines` loads an `ArrayBuffer` made in another realm, such as an iframe's.

<!-- entry: fix -->
