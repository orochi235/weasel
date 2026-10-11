---
'@weasel-js/font': patch
---

A family registered only through `registerFontOutlines` was laid out in the default family, with a "not registered" warning, for as long as its font bytes were loading, and then reflowed when they landed. `resolveFontVariant` now reports it as pending, the way it does a family whose atlas is still loading.
