---
'@weasel-js/theme': patch
---

`parseTokenValue` unwraps a font family only when one quote closes both ends, so it round-trips through `serializeTokenValue` unchanged.

<!-- entry: rank=-5 fix -->
