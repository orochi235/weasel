---
"@weasel-js/hud": patch
---

`Hud.add` leaves a widget already in the HUD where it is. Adding one twice used to list it twice, so it drew twice, Tab visited it twice, and `remove` took out only one of the two, leaving a disposed widget drawing.
