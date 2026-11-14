---
'@weasel-js/ui': patch
'@weasel-js/prefs-editor': patch
---

`Tree`, `LayerList` and `PrefsForm` add a row to the selection on Cmd-click on a Mac and Ctrl-click elsewhere, as a canvas does; a Ctrl-click on a Mac no longer toggles a row.

The same key, with Alt, makes a `Tree` or pref-schema drag an alias.

<!-- entry: fix behavior -->
