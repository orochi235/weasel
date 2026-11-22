---
'@weasel-js/theme': patch
---

An axis value that is not an object, or whose `scheme` is neither `dark` nor `light`, is refused. `derive` reports it, and `defineTheme` and `emitCss` throw rather than write the scheme into the stylesheet.

<!-- entry: fix -->
