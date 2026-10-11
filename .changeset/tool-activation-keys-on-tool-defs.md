---
'@weasel-js/core': patch
'@weasel-js/routing': patch
---

A tool's activation key now comes only from the `keybinding` on its definition. The built-in select, rect, ellipse, line, polygon, pencil, text, hand, and pen tools declare theirs there, with the same keys as before. Two things change for a consumer tool that reuses one of those ids: a `keybinding` it declares is honored, where it used to be ignored in favor of the built-in key, and one that declares none no longer gets the built-in key by id.
