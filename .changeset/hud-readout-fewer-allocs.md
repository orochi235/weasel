---
'@weasel-js/hud': patch
---

A HUD redrawing a widget allocates less each frame. `attachHud` refills a widget's cached entry in place rather than replacing it, a kit widget's `deps` hands back one array until it changes, and a text widget builds its command at the corner it is drawn at and returns the same array while nothing changed.
