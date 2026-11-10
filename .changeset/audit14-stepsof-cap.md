---
'@weasel-js/ui-logic': patch
---

`stepsOf` throws a `RangeError` for a cap that is not a whole number 0 or more. A cap such as `2.5`, `-1` or `NaN` never matched the count of steps taken, so an endless sweep, and a `Sequence` over one, walked forever.
