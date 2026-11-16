---
'@weasel-js/ui': patch
---

Pref paths, leaf kinds, column ids, effect kinds, tool ids and toolbar ids named `constructor` or `toString` no longer resolve to built-ins.

A `DataGrid` column with such an id shows an empty cell rather than a function's source, a params surface draws such a pref with its built-in control rather than calling `Object.prototype.constructor` as its renderer, and a `PrefsBar` value at a `__proto__` path is kept as data rather than replacing the object's prototype. `EffectList` kinds, `KeyDiagram` marks, `TokenPanel` scales, registered action icons and labels, and `ToolPalette` shortcuts read only their own entries.

<!-- entry: fix -->
