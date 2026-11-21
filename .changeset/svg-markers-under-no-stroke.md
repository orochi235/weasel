---
'@weasel-js/svg': patch
---

`parseSvg` keeps an element's markers when its stroke is `none` or unset, as SVG draws them. They sit on an `SvgStroke` with a `none` paint, the shape `serializeSvg` already wrote back.

<!-- entry: fix data -->
