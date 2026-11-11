---
"@weasel-js/hud": patch
---

A HUD window's `zoneAt` and `hitTest` treat a point that is not finite as outside the window, so a press there starts no drag.

<!-- entry: rank=-5 fix -->
