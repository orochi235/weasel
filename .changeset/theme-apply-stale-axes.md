---
"@weasel-js/theme": patch
---

`applyTheme` removes `data-wzl-<axis>` attributes the new theme lacks, so the old theme's rules stop matching.

<!-- entry: fix -->
