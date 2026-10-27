---
'@weasel-js/menu': patch
---

A menu item can keep its menu open: with the new `keepOpen` flag on `MenuItemEntry`, choosing the row runs it, highlights it, and leaves the menu open, and the controller's subscribers hear the change so a renderer redraws the row's `checked` state. Both ui's DOM menu and the HUD menu honor it, since both run items through the controller. Adds API.
