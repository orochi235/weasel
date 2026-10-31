---
"@weasel-js/ui": patch
---

`ReorderHandle` forwards its ref under React 18, so `ListEditor` keeps focus on a moved entry's handle there; `ItemList` rows show a hover background.
