---
'@weasel-js/labkit': patch
---

`summarizeLeaf`, a dialog row's summary, and an auto row's tooltip write a number through its leaf's `display`, and infinity as the word its `endless` end gives it. They used to honor only a `unit`, so `.display(compact())` read `2000000` and an endless timeout read `Infinity`.
