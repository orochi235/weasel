---
'@weasel-js/prefs': patch
'@weasel-js/quantity': patch
'@weasel-js/theme': patch
---

Fix rounding, token-reading and CSS-escaping bugs in prefs, quantity and theme

- A linear pref unit's shown value now rounds a negative half away from zero, as its formatted text does: `-0.125` at two places shows `−0.13` in the field, not `−0.12`.
- The `ordinal`, `roman` and `integer` kinds round a half away from zero, as the numbers they show do: `-2.5` reads `−3rd`, not `−2nd`, and typing `-2.5` into an integer field reads as −3.
- `tokenPx` reads a bare `0` as 0px instead of throwing, so a theme that sets a radius to `0` no longer breaks the HUD's panel drawing.
- `prefsCss` escapes line breaks in the strings it writes; a string pref that held one used to lose its declaration.
