---
'@weasel-js/core': minor
---

Simplify and Offset Path leave their params in the last-operation panel after a commit, and Offset Path takes `join` and `miterLimit`.

`SIMPLIFY_PATH_PARAMS` and `OFFSET_PATH_PARAMS` are the two actions' `params` forms, so a slider driving one reads its range from the leaf. Offset Path's corners follow `join` (`'miter'`, `'round'` or `'bevel'`), which its documentation promised and it ignored.

<!-- entry: new api fix -->
