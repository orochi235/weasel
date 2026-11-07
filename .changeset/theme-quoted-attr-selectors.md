---
'@weasel-js/theme': patch
---

`applyTheme` and the stylesheet emitter quote a theme name or axis value inside their attribute selectors, so a name holding a `'` or a `\` styles its elements. Before, the rule came out malformed and the browser dropped it, leaving the subtree on the default theme.
