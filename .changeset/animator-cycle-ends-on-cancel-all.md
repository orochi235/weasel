---
'@weasel-js/animator': minor
---

`animator.cancelAll()` ends a running `cycleVertexColors`, clearing its colors, where the cycle had frozen on screen.

`keepAlive` takes an optional `onCancel`, which hears the entry end through its release function or from `cancelAll`.

<!-- entry: fix api -->
