---
'@weasel-js/menu': patch
'@weasel-js/ui': patch
---

Menus follow a right-to-left layout. `keyStep`, `planKey` and a controller's `key` take an optional direction: under `'rtl'` Left opens a submenu and Right closes one, and an edge still reports forward as 1 and back as -1. `placeMenu`, `placeSubmenu` and `placeMenuUnder` take one too, and under `'rtl'` open to the left first (a menu under a button right-aligns to it). `ContextMenuHost`'s panels read the direction from their own computed `direction`, and `MenuBar` steps between titles by its bar's, so Left moves to the next title.
