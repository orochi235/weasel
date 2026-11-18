---
'@weasel-js/ui-logic': minor
---

`TextExtent.capHeight` lets a measure env say a control's label is trimmed to its capitals, and `measureButton` lays the label out that way.

With it, the label part is `capHeight` tall and centered, and the baseline sits half a cap below the button's middle; without it, the label keeps its whole line box as before. ui's `createDomMeasureEnv` reports it in browsers that support `text-box`.

<!-- entry: api new -->
