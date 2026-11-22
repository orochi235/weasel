---
'@weasel-js/prefs-schema': patch
---

`prefStatusAt` narrows an alias inside an object, a union, a list, or a map leaf by the leaf it shows.

While that leaf is hidden or disabled, so is the alias, as `applyPrefConditions` has it.

<!-- entry: fix -->
