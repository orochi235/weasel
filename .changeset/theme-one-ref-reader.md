---
'@weasel-js/theme': patch
---

`tokenPx` reads a length with the same parser as the rest of the theme, so `5.px` and an uppercase `PX` unit read as pixels too. The CSS emitter reads a `{token}` reference through the same function `resolveTokens` uses.
