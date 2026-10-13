---
'@weasel-js/routing': patch
'@weasel-js/core': patch
---

Fixes: a long-press on a canvas with several views fired on whichever view had last taken input, not the view the press went down in. A touch held in one view while a mouse moved over another ran its `longPress` or `contextMenu` binding against the wrong view's dispatcher and context. The hold now fires on its own view, from its timer and from the `contextmenu` a platform sends for a hold.
