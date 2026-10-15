---
'@weasel-js/core': patch
---

A right-click, an unclaimed long-press, Shift+F10 or the ContextMenu key now runs the `menu.context` standard action. It selects the shape under the pointer if it was not selected, then asks the menu host for the menu declared for that hit. With no menu declared, nothing changes: the browser menu stays suppressed as before.
