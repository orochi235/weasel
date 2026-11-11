---
"@weasel-js/hud": patch
---

Detaching `attachMenuHost` while a menu is open gives focus back to the widget that held it before the menu opened, as closing the menu does.

<!-- entry: rank=-5 fix -->
