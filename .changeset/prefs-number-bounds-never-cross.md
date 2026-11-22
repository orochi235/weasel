---
'@weasel-js/prefs-schema': patch
---

A number leaf's `minAt` and `maxAt` stay inside its declared `min` and `max`, so its value and slider never get a minimum above the maximum.

<!-- entry: fix -->
