---
"@weasel-js/theme": patch
---

An axis can no longer be named `theme` or `variant`: `defineTheme` throws and `derive` reports it as `invalid`. `applyTheme` stamps `data-wzl-theme` and `data-wzl-variant` itself, so such an axis's attribute was overwritten or taken off and the theme's rule matched nothing.
