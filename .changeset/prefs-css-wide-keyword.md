---
'@weasel-js/prefs': patch
---

`prefsCss` quotes an enum option that is a CSS-wide keyword, such as `inherit`, so the custom property holds the option.

The keywords are `inherit`, `initial`, `unset`, `revert`, `revert-layer` and `default`.

<!-- entry: fix -->
