---
'@weasel-js/ui': patch
---

`fill.color` on `CurveEditor` and `createFunctionLayer` did nothing: the fill was always painted in the theme color. The area under the curve is now painted in the color given.
