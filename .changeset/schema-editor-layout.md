---
'@weasel-js/prefs': patch
'@weasel-js/ui': patch
---

`PrefSchemaEditor` lays a schema out by dragging. A node dragged from the structure tree can be dropped in the live preview: beside a row, into a group, or onto a rail entry, which opens that page when the drag rests on it. A palette under the toolbar holds chips for a new page, tab, panel, section, and label, each dragged into the tree or the preview. The preview draws empty groups, so a new one is somewhere to drop into.

`PrefsForm` draws a leaf of kind `label` as text among its rows: the leaf's name, with its description under it. Nothing is stored for it. `PrefsForm` also takes `dropMark`, to mark where a drag would land, and `showEmpty`, to draw groups with no leaves; `prefDropTargetAt` finds a drop mark from a pointer position. `visiblePrefSubtree` takes `keepEmpty`.

`Tree` takes `onDragOutside` and `onDropOutside`, so a drag begun in it can end somewhere else, and `externalDrag` with `onExternalTarget`, so a drag begun somewhere else can land in it.
