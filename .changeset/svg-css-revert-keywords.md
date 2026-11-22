---
'@weasel-js/svg': patch
---

`parseSvg` honors `revert` and `revert-layer`. `revert` drops every author declaration of the property, so an inherited one such as `fill` takes the parent's value, and `revert-layer` takes the value the layers below it give.

<!-- entry: fix data -->
