---
'@weasel-js/ui': patch
---

An `aqua` or `metal` badge effect throws a `RangeError` for a tint or darkness mix outside 0..100, where its gradient stop had painted black.

That is `aqua`'s `equatorTint` and `baseTint`, and `metal`'s `topDarkness` and `baseDarkness`.

<!-- entry: fix behavior -->
