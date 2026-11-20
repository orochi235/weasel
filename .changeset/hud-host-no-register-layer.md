---
'@weasel-js/hud': major
---

`HudHost` drops `registerLayer`, which no HUD ever called.

A host bound with `hud.bind` gets redraw requests and frames, never a layer; `attachHud` registers the HUD's layer itself. Drop `registerLayer` from a host object written for `hud.bind`.

<!-- entry: breaking -->
