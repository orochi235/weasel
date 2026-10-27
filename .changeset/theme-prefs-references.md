---
'@weasel-js/theme': patch
---

`themePrefsReferences(schema)` (on `@weasel-js/theme/prefs`) reads a token's CSS as a reference to another
custom property where the whole value is one `var()`, and names the leaf of a theme prefs schema that edits it.
Adds API.
