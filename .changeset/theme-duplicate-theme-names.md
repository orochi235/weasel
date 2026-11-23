---
'@weasel-js/theme': patch
---

`generateTokens` refuses two themes with the same name and names it, where it emitted both and let one silently override the other.

<!-- entry: fix -->
