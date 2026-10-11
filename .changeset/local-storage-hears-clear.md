---
'@weasel-js/storage': patch
---

`localStorageAdapter` reports another tab's `localStorage.clear()`. A clear arrives as one `storage` event naming no key, which the adapter ignored, so a record cache in this tab went on holding values storage no longer had. For a prefs store with migrations, the next single write then left storage with one record and no `$version`, and the following load ran every migration over a value already in the current shape. Subscribers now hear a delete for each record under their prefix that the clear removed, and the prefs version watch writes `$version` back.
