---
'@weasel-js/routing': patch
---

`toolOptionsPrefs` throws for a host `shared` default whose key no tool shares, such as a misspelled `fil`, where it used to drop the default without a word.

<!-- entry: fix behavior -->
