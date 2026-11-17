---
'@weasel-js/prefs': minor
'@weasel-js/prefs-schema': minor
---

`usePrefGroup(store, path)` reads one prefs group as an object of its values, and writes the leaves a patch names.

Its paths are typed by `PrefGroupPath`, and its value by `PrefValuesOf<PrefGroupAt<S, P>>`.

<!-- entry: rank=5 api -->
