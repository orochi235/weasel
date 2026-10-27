---
'@weasel-js/hud': patch
---

A HUD menu's color row that has a `set` is now edited from the menu. It draws as a submenu with the color as a swatch in its icon column; the submenu holds one row per palette color, drawn as its swatch, which writes that color and closes the menu, then a `Hex` text row that writes a typed `#rgb`, `#rrggbb` or `#rrggbbaa` while the menu stays open. A row with `alpha` keeps its opacity when a swatch is picked. The palette comes from the new `palette` option on `createMenuWidget` and `attachMenuHost`, defaulting to the new `DEFAULT_MENU_PALETTE`. Adds API. A color row with no `set`, or disabled, still draws read-only.
