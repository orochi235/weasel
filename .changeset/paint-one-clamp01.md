---
'@weasel-js/paint': patch
---

paint's color parsing and color-space conversion share one `clamp01`, kept beside its `lerp`, rather than a copy each.

<!-- entry: internal -->
