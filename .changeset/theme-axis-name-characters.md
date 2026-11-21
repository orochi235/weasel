---
'@weasel-js/theme': patch
---

An axis name may hold only letters, digits, `-`, and `_`.

`defineTheme` and `fromDtcg` refuse another, and `derive` reports it, since `applyTheme` could not stamp or match it.

<!-- entry: fix behavior -->
