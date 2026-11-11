---
"@weasel-js/hud": patch
---

A HUD window lands no point that is not finite. `zoneAt` read a `NaN` coordinate as inside the window, in its interior, so `hitTest` answered true for it and a press there started a drag.
