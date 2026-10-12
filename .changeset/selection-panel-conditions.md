---
'@weasel-js/ui': patch
---

`SelectionPanel` honors `showIf` and `enableIf`, on a leaf, a section, and a field of an `object` leaf. A condition reads the selected node at the paths the schema's leaves are keyed by (`data.locked`, `data.stroke.width`). A hidden row draws nothing, and a hidden section takes its heading or its tab with it. A disabled row draws its controls disabled and its label dimmed, down through object fields, a run of paired flags, lists, maps, unions, and actions, in a row and in a section drawn as a bar.

With several nodes selected, a row is shown if its `showIf` holds for any selected node, and enabled only if its `enableIf` holds for all of them.

Adds API: `PropertyRenderContext` gains `disabled`, so a custom renderer is told, and `disabledAt(path)`. `effectiveSections` takes a fourth argument that narrows each kind's schema before it is read. `conditionedSections(kinds, entries, nodes)` returns the sections with the conditions applied and the set of disabled paths, and `selectionJudge(schema, nodes)` is the rule above as a `PrefConditionJudge`.
