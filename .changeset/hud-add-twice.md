---
"@weasel-js/hud": patch
---

`Hud.add` leaves a widget already in the HUD where it is, so adding it twice no longer draws it twice. `remove` then takes it out whole.

<!-- entry: fix -->
