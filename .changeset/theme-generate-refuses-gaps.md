---
'@weasel-js/theme': patch
---

`generateTokens` refuses themes where one theme or selection lacks a token another has, rather than writing a `themes.ts` that fails to compile.

<!-- entry: fix -->
