---
'@weasel-js/hud': minor
---

`attachMenuHost(hud, host)` places the menu on the canvas the HUD is attached to, so `toCanvas` and `canvasSize` are optional.

A HUD answers in its canvas's space through `hud.toCanvas(client)` and `hud.canvasSize()`, which `attachHud` fills from the canvas element. A `HudHost` of your own can supply them as `toCanvas` and `size`.

<!-- entry: api -->
