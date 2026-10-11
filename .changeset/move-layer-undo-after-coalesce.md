---
'@weasel-js/core': patch
---

With `coalesceWindowMs` set, two `scene.moveLayer` calls on one layer inside the window merged into one undo step whose undo pulled a different layer out of the stack: `[a, b, c]`, move `a` to 2 then to 1, undo, gave `[c, b, a]`. Undo and redo of a layer move now find the layer by id, so the step returns to the order it started from.
