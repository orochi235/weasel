---
"@weasel-js/labkit": patch
---

`.section('')` is no section: the leaf or group stays loose, as it does with no `.section()` at all, so it reads back unchanged through `prefsFromConfig` and `f.prefs`. It made a section with an empty heading, which the trip through prefs dropped.
