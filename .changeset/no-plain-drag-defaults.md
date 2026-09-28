---
"@weasel-js/core": patch
---

`areaSelect`, `insert`, `slice` and `lassoSelect` no longer declare a default binding. A plain drag carries no intent of its own, so none of them answers one unless something binds it: the select tool marquees on empty canvas, the shape tools insert, and the slice and lasso tools bind their own actions, as before. A canvas that relied on a plain drag marqueeing under a tool that binds no drag now opts in with the new `areaSelectContribution()` in its `ambient` list. `onEmptyCanvas` is the empty-canvas predicate the select tool and that contribution share.

This is a behavior change for any consumer that registered these actions without a tool binding them.
