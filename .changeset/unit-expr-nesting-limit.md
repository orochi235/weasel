---
'@weasel-js/quantity': patch
---

`resolveUnitExpr` throws its own `unitExpr:` error for parentheses or signs nested more than 1000 deep, rather than overflowing the stack.

<!-- entry: fix -->
