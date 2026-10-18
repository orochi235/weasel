---
'@weasel-js/ui': patch
---

`ToolPalette` takes `stacks`: lists of tool ids that share one button. The button shows the stack's tool in use, or the one last used from it, with a mark in its corner. A click opens a menu of the stack, and a click with `stackCycle` held (Alt by default) makes the next tool in it active instead. `ToolButton` gains a `menu` prop for buttons that open a menu, and its `onClick` now receives the click event.
