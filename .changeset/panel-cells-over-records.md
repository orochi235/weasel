---
'@weasel-js/ui': major
---

ui's panel engine reads records, not scene nodes: `selectionJudge` and `conditionedSections` take `PanelRecord`s that read a path.

This is breaking: pass `{ valueAt: (path) => nodeValueAt(node, path) }` for each node where a node went, `nodeValueAt` coming from `@weasel-js/ui-canvas`. The engine is `@weasel-js/ui/components/PanelCells`, which also exports `panelSections`, `panelSource`, `PanelCellScope`, `LeafWrites`, `boundAt` and `leafAcross`, for drawing a panel of prefs sections over records of your own. Its other names, `effectiveSections`, `isPanelSection`, `panelRowsOf` and the `Panel*` types among them, come from there rather than from `SelectionPanel`'s entry.

<!-- entry: breaking api -->
