---
'@weasel-js/renderer': patch
'@weasel-js/core': patch
---

A group carrying `retain` that also has `effects` or `isolate` is now retained: its surface keeps what the group's own buffer composites, effects run, so a still frame runs none of its passes. A retained group inside another group's effects buffer, such as a layer in a `LayerGroup` with effects, now composites into that buffer instead of drawing straight through; it is drawn single-sampled there, as drawing into that buffer is. `drawLayers` now marks a layer with `effects` for retaining under the same rules as any other layer. A retained group inside another retained group is still drawn straight through.
