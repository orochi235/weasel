---
'@weasel-js/routing': patch
---

A `contextmenu` event makes the canvas it reached the active input scope, as a press or a wheel does. The keyboard ContextMenu key sends one with no press before it, so on a page with several sibling canvases the menu's rows used to resolve and run against whichever scope was newest rather than the canvas the menu opened on.
