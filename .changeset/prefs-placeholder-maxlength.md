---
'@weasel-js/prefs': minor
'@weasel-js/ui': patch
'@weasel-js/labkit': patch
---

A number pref takes a `placeholder` and a string pref a `maxLength`, and `PrefsForm` honors both as labkit's `ControlPanel` already did.

A stored string longer than its leaf's `maxLength` reads cut to it. Labkit's `.placeholder()` and `.maxLength()` write these same fields.

<!-- entry: api -->
