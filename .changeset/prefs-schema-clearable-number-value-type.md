---
'@weasel-js/prefs-schema': patch
---

`PrefValuesOf` types a `clearable: true` number leaf as `number | undefined`, the value it holds once cleared. `pref.number` returns a leaf that is not clearable, so its value stays `number`.

<!-- entry: fix -->
