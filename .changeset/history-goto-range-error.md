---
'@weasel-js/history': patch
---

`history.goto(n)` throws a `RangeError` for an `n` that is NaN, not a whole number, below 0, or past the last entry.

Calls that used to pass silently now throw. A timeline that can be clicked after the stack shrinks clamps its target before calling.

<!-- entry: fix behavior -->
