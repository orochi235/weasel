---
"@weasel-js/core": patch
"@weasel-js/ui": patch
"@weasel-js/labkit": patch
---

Fields now refer to each other by the full path their values are read and written at (`'camera.type'`, `'pose.y'`).

`pair` is no longer a shared label string. A row is declared once, on its first leaf: `pair: { with: 'pose.y', label: 'Position' }`, where `with` names the other leaves on the row (one path or several) and `label` overrides what the row reads, which is otherwise the declaring leaf's `name`. This is a breaking change to the shape: a schema that set `pair: 'Position'` on each member now sets `pair` on the first member only. labkit's builder follows: `.pair({ with: 'y', label: 'Offset' })`. `pairRowsOf` (core) resolves a surface's leaves to their rows, and `SelectionPanel`, `ToolOptionsBar`, and labkit's `ControlPanel` all group rows through it.

A new built-in pref kind, `field`, holds such a path. Its control is a picker over the fields of the surface drawing it, labeled `Name (path)`, narrowed by the leaf's optional `kinds`. `prefFieldChoices` lists a schema's fields, with a flag for whether a group's key is part of a path, since a prefs form nests values by group and a node's property panel does not. `PrefsForm` takes `fields` for a form that edits another schema, and `PrefSchemaEditor` edits a leaf's `pair` by picking its partners from the schema's fields.
