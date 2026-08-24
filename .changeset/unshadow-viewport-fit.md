---
'@weasel-js/core': patch
---

Rename the viewport `computeFitView` to `computeFitViewport`. It was unreachable from the package entry: an identically-named export from the minimap module shadowed it. This is a breaking rename of a symbol nobody could import.
