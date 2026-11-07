---
'@weasel-js/history': patch
---

`goto` ignores a depth that is not a whole number, and `timestampAt` answers `undefined` for one. `goto(1.5)` used to undo past the depth and redo one entry back, and `goto(NaN)` reported an empty step; `timestampAt(0.5)` threw.
