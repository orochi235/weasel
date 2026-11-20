---
'@weasel-js/labkit': patch
---

A field, item or variant inside another leaf throws on a row-only option such as `.showIf(fn)` or `.render()`, rather than dropping it.

Write a condition inside a value as data (`.showIf({ path, is })`), and put the rest on the outer leaf.

<!-- entry: fix behavior -->
