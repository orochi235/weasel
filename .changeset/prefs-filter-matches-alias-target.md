---
'@weasel-js/prefs': patch
'@weasel-js/ui': patch
---

A filter matches an alias as the row it draws. `filterPrefSubtree` reads an alias with no name or description of its own by its target's, so a `PrefsForm` query that finds a pref also finds the unnamed aliases of it; before, those rows dropped out. The function takes a fourth argument, `leafAt`, for finding a target outside the subtree being filtered, which `PrefsForm` passes so an alias of a hidden pref still matches.
