---
"@weasel-js/theme": patch
---

`themePrefsValues` writes a token leaf outside any group at its own key, not under a key one character short of its name.

<!-- entry: rank=-5 fix -->
