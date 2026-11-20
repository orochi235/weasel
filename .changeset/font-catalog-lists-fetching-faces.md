---
'@weasel-js/font': patch
---

`listAtlasFonts` and `listFontWeights` list an eagerly registered variant while it fetches, as they already listed a lazily declared one.

<!-- entry: fix -->
