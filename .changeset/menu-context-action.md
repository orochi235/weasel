---
'@weasel-js/core': patch
---

A right-click, an unclaimed long-press, Shift+F10 or the ContextMenu key now runs the `menu.context` standard action. It selects the shape under the pointer if it was not selected, then asks the menu host for the menu declared for that hit. It is disabled where no menu is declared for the hit, so nothing is selected and a long-press still falls through to the click and drag bound there; the browser menu stays suppressed as before. `MenuHost` gains `has(req)`, which answers whether `open(req)` would show anything.
