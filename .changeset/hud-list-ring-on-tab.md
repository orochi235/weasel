---
'@weasel-js/hud': minor
---

Tabbing into a HUD list rings its active row, as Tab shows focus on every other HUD widget.

A widget that draws its own focus (`focusRing: false`) can read the new `HudDrawCtx.focusVisible`, which is true when the HUD shows focus, as after Tab, and false after a press.

<!-- entry: fix api visual -->
