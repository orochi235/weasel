---
'@weasel-js/theme': patch
---

`fromDtcg` refuses an axis named `theme`, `variant`, or `__proto__`, as `defineTheme` does, rather than loading a theme that never applies.

<!-- entry: fix -->
