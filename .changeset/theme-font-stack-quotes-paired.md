---
'@weasel-js/theme': patch
---

`parseTokenValue` unwraps a font family only when it is quoted at both ends with the same quote. A lone quote at either end used to be dropped, so reading back what `serializeTokenValue` wrote for such a family changed it again each time.
