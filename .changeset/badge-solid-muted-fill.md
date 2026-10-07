---
'@weasel-js/ui': patch
---

A solid `muted` `Badge` is visible again. Its fill follows `--wzl-fg-muted`, which steps down from the current text color, and the badge used to set its own text color to white — so in light mode the fill came out white on a white surface, which blanked the modifier chord in every `GestureRoute` and `FallthroughDiagram`. The label color now sits on the badge's content, so the fill and stroke resolve against the surrounding text, and a solid muted label uses `--wzl-fg-inverse`, which reads in both modes. Pill badges get the same fix.
