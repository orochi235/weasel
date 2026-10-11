---
'@weasel-js/theme': patch
---

`emitCss` rounded the `alpha` of a token that references another to a whole percent, so a pin such as `{ value: '{fg}', alpha: 0.125 }` was 13% in `tokens.css` and `0.125` from `resolveTheme` and `applyTheme`. The stylesheet now keeps the same precision as the resolved record. The built-in theme's alphas are whole percents, so its `tokens.css` is unchanged.
