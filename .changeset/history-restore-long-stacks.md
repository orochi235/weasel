---
'@weasel-js/history': patch
---

`restore` and `switchBranch` take stacks of any length, where a few hundred thousand entries threw a `RangeError`.

<!-- entry: fix -->
