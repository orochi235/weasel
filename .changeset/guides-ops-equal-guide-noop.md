---
'@weasel-js/guides': patch
---

`createAddGuideOp` and `createReplaceGuideOp` record no undo step when the store already holds the guide they write.

<!-- entry: fix -->
