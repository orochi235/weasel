---
"@weasel-js/core": patch
---

`writtenBy` reads a registered op through a copy rebuilt from its args, so an op that records its undo on first apply (reorder, delete, reparent) keeps that apply for the scene it is committed to.
