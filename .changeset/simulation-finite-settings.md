---
'@weasel-js/simulation': patch
---

A simulation throws a `RangeError` on a setting or tick count that is not a finite number, as a clock does.

Alpha, its target, decay and minimum, velocity decay, and `tick`'s count are checked, at creation and when set.

<!-- entry: fix behavior -->
