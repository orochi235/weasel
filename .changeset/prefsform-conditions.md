---
'@weasel-js/ui': patch
'@weasel-js/prefs': patch
---

`PrefsForm` honors `showIf` and `enableIf`, on a leaf, a group, and a field or a section of an `object` leaf. A node whose `showIf` fails draws nothing and takes no space, and a hidden group takes its rail entry, its tab, its heading, and its sub-page with it; a group left with nothing to draw goes too. A node whose `enableIf` fails draws with its control disabled and its label dimmed, and a group's disables everything under it: every built-in kind, a list's entries and its add and remove buttons, a map's keys, a union's select, and an action's button, in a row and in a bar. A condition reads the form's `values` by path from the schema root, and a leaf with nothing stored reads as its default.

Adds API: `PrefRenderContext` gains `disabled`, so a custom renderer is told, and `disabledAt(path)` for the fields under a leaf. `PropertyRow` takes `disabled`, which marks the row `data-disabled` and dims its label; `PropertyField` sets it from its own `disabled`. `ListEditor`, `MapEditor`, `UnionPicker`, and `PrefControl` take `disabled`. `prefReader(schema, values)` in `@weasel-js/prefs` is the reader the form uses.

An alias row is shown only while its own `showIf` and that of the leaf it shows both hold, and enabled only while both `enableIf`s hold, with every group above that leaf counted.
