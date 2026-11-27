---
'@weasel-js/routing': patch
---

`toolOptionsPrefs` throws for a host `shared` default whose key no tool shares, such as a misspelled `fil`, rather than dropping it.

<!-- entry: fix behavior -->
