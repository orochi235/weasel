---
'@weasel-js/ui': patch
---

A `LayerList` row is a `row` in a `treegrid` but held no `gridcell`, which the role requires and assistive technology reads the row through. Each row's content is now in a `gridcell`; the layout is unchanged.
