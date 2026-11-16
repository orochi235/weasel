---
'@weasel-js/prefs': patch
---

`PrefsStore.reset(path)` warns when no leaf is at or under `path`, as `set` and `setAuto` do for a path the schema lacks.

<!-- entry: fix -->
