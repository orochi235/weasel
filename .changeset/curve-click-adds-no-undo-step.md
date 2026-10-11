---
'@weasel-js/ui': patch
---

In `CurveEditor` and `LayeredCurveEditor`, clicking an anchor without moving it added a step to the built-in undo, so the next Cmd/Ctrl+Z did nothing visible. A gesture that leaves its layer as it found it no longer adds a step.
