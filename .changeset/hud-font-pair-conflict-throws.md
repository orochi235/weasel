---
'@weasel-js/hud': patch
---

`attachHud` throws, saying why, when its `font` pair differs from the one another HUD on the page registered the HUD font from.

Every HUD shares that one family. Give each HUD the same `font`, or register the other atlas under a family of its own and pass its name.

<!-- entry: fix behavior -->
