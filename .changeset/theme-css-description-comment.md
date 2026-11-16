---
"@weasel-js/theme": patch
---

`emitCss` keeps a token description holding `*/` inside its comment, so the text after it is no longer read as CSS.

<!-- entry: fix -->
