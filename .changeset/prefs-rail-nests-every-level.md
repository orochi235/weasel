---
'@weasel-js/ui': minor
---

Under `subPages`, `PrefsForm`'s rail lists every nested group, at any depth, and each opens a page
of its own. A page holds its group's own leaves, tabs, and panels; a group with none of those opens
its first nested entry. The rail nests its entries a step in per level, and under `foldable` an entry
at any depth folds the ones under it. `prefRailItems` takes a second argument, `deep`, that lists
every level, and `PrefRailItem.depth` is no longer limited to 0 and 1.

A top-level page under `subPages` now keeps its tabs and panels, which it used to drop, and the
root's own page is drawn whole.

`PrefSchemaEditor`'s live preview draws its form with `subPages`.
