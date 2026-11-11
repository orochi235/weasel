---
"@weasel-js/theme": patch
---

An axis can no longer be named `theme` or `variant`: `defineTheme` throws and `derive` reports it as `invalid`.

`applyTheme` stamps `data-wzl-theme` and `data-wzl-variant` itself, so such an axis never applied; give it another name.

<!-- entry: fix -->
