---
'@weasel-js/theme': patch
---

`generate` gives every swatch a distinct name, so a generated swatch no longer repeats an anchor's name.

Two anchors that share a name come back as `name` and `name-2`.

<!-- entry: fix -->
