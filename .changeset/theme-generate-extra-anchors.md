---
'@weasel-js/theme': patch
---

`generate` returns `count` swatches when given more anchors than that, keeping the first ones.

`derive` reports a categorical ramp with more anchors than steps as `invalid`, and still derives its steps.

<!-- entry: fix -->
