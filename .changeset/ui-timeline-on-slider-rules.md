---
"@weasel-js/ui": patch
---

`Timeline`, `Slider`, `BandEditor` and the curve editor's keyframe layer pick a dragged value by `@weasel-js/ui-input`'s slider rules.

The ruler pans and zooms with its `spanPan` and `spanZoom`. `snapToNearest`, `toFraction` and `spanFraction` are exported as before.

<!-- entry: internal -->
