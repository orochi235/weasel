---
'@weasel-js/prefs-schema': patch
---

`nestPrefValues` no longer throws when a deeper path runs through a shorter one holding a number or string: the later entry wins.

<!-- entry: fix -->
