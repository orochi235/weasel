---
'@weasel-js/ui-logic': patch
---

`stepsOf` throws a `RangeError` for a cap that is not a whole number 0 or more, where a sweep or `Sequence` over it would have walked forever.

<!-- entry: rank=-5 fix -->
