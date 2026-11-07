---
'@weasel-js/theme': patch
---

`defineTheme` and `loadDTCG` refuse a token name holding anything but letters, digits, `-` and `_`, as `derive` already reported it. Before, such a name reached the stylesheet as an invalid custom property (`--wzl-font size: …`), which the browser dropped without a word. This can break a theme that relied on one: rename the token.
