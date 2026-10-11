---
'@weasel-js/ui': patch
---

`TokenPanel` no longer files a token valued `inherit`, `initial`, `unset`, `revert`, or `revert-layer` under Color. In a browser, `inferTokenType` asked `CSS.supports('color', value)`, which is true for every CSS-wide keyword, so such a token was drawn with a color chip.
