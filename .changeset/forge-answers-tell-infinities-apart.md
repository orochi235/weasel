---
'@weasel-js/forge': patch
---

An isolated story's controls answer afresh when a value moves between `Infinity`, `-Infinity`, and `NaN`. A control shown, hidden, or validated by such a value follows it, and a frame-local arg set over one stops applying when config moves to another.

<!-- entry: fix -->
