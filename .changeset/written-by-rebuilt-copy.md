---
"@weasel-js/core": patch
---

An op that records its undo on first apply, such as reorder, delete or reparent, keeps that undo for the scene it is committed to.

`writtenBy` reads a registered op through a copy rebuilt from its args.

<!-- entry: rank=-5 fix -->
