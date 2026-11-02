---
'@weasel-js/core': patch
---

`clampMove({ bounds })` from `@weasel-js/core/move` is a move behavior that keeps the dragged nodes inside a
world rect: the drag's translation is clamped so the box around every dragged node stays in `bounds`, in
the preview and the commit alike. `bounds` can be a function, read each frame, for a rect that changes
size.
