---
"@weasel-js/prefs": patch
"@weasel-js/ui": patch
"@weasel-js/labkit": patch
---

Adds API: `prefLeafValue(leaf, held, { unset })` in `@weasel-js/prefs` answers what a params surface shows for the value held at a leaf: that value, else the leaf's default. `prefValueAbsent(leaf, held)` says whether a value counts as held: `undefined` and `null` do not, except a paint's `null`, which is "no paint". `PrefsForm`, `PrefControl`, `SelectionPanel`, and labkit's `ControlPanel` and matrix all read a leaf's value through it.

Changes what three surfaces show. A value held as `null` now shows the leaf's default in `PrefsForm` and `ControlPanel` (it drew an empty field), and reads as nothing held in `SelectionPanel`, where an `absentIsDefault` leaf shows its default. A clearable leaf holding nothing shows as cleared everywhere: `PrefsForm` drew a clearable number at its default, and `ControlPanel` did too when the config lacked the key.
