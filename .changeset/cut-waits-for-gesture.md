---
'@weasel-js/core': patch
---

Cmd/Ctrl+X pressed while a drag was in flight deleted the nodes the drag was moving. `clipboard.cut` is now held off mid-gesture, as `delete` already was, and commits through the same `commitDeleteToScene` path, which takes an optional history label.
