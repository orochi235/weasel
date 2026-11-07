---
'@weasel-js/theme': patch
---

`themePrefsSchema` groups a token the manifest does not list the way the manifest groups its siblings, so a theme's own `danger-…` token sits under `status` beside the built-in ones. A token's `scope` is read from every branch of a split definition, not only the first.
