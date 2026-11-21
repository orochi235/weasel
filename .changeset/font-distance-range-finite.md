---
'@weasel-js/font': patch
---

`parseBmFont` ignores a `distanceField.distanceRange` that is not finite, so such an atlas draws antialiased text.

<!-- entry: fix visual -->
