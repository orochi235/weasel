---
'@weasel-js/renderer': patch
'@weasel-js/core': patch
---

Redrawing a retained surface larger than one tile no longer costs more than drawing it whole: 4 layers of 1,000 commands with their pan margins at 2560x1600 went from 16.5–18.3 ms a redraw to 4.8–5.4, against 5.0–5.9 untiled (M5 Max, 4–6 fresh contexts each). Each tile now skips the commands that miss it at any depth, where it used to look only at the retained group's own children, so a layer whose commands sit inside one group staged every command in every tile.

Text with a pattern or registered paint in `local` or `world` units now follows a pan in a retained layer, as a path with that paint does, instead of being drawn straight through while the view moves.

`drawLayers` retains a layer that runs effects passes, its own or a group's inside it, from 10 drawing commands rather than 250 (`LayerRetainPolicy.minCommandsWithEffects`, also on `<Canvas retain>`): under a blur of radius 8, compositing such a layer was already cheaper than drawing it at 10 commands.
