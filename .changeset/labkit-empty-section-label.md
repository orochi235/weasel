---
"@weasel-js/labkit": patch
---

`.section('')` leaves a leaf or group loose, as no `.section()` call does, so it reads back unchanged through `prefsFromConfig` and `f.prefs`.

<!-- entry: rank=-5 fix -->
