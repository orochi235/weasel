---
'@weasel-js/ui': patch
---

A `BarMenu` that opened itself gives focus back to its button on close only when focus is in its own menu or one of its submenus. Before, focus in any other menu on the page counted, and closing pulled focus out of that menu.
