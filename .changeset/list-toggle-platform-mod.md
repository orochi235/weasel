---
'@weasel-js/ui': patch
'@weasel-js/prefs-editor': patch
---

`Tree`, `LayerList` and `PrefsForm` toggle a row on Cmd-click on a Mac and Ctrl-click elsewhere, as a canvas does.

A Ctrl-click on a Mac, its secondary click, no longer toggles a row. The same key with Alt makes a `Tree` or prefs-schema drag an alias.

<!-- entry: fix behavior -->
