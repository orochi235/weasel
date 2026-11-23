---
'@weasel-js/theme': patch
---

`generateTokens` writes `TokenName` as `never` in `themes.ts` when no theme has a token, where it wrote a type that did not parse.

<!-- entry: fix -->
