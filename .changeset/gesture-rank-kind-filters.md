---
'@weasel-js/gestures': patch
---

A binding on a wheel or pinch direction now wins over one on any direction, and a primary-button drag over a drag on any button, whichever was registered first.

A hover binding with `held: 'optional'` likewise ranks below one with no button held.

<!-- entry: fix -->
