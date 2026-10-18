---
'@weasel-js/prefs': patch
'@weasel-js/core': patch
'@weasel-js/ui': patch
'@weasel-js/labkit': patch
---

The Properties W and H fields hold a node to its `data.minSize`, as resize and
insert already do: typing a smaller width shows and stores the minimum. With
several nodes selected, each is held to its own minimum.

A number leaf takes `minAt` and `maxAt`, bounds read from where its value is
held, which `prefNumberAt` folds into `min` and `max` for one holder.
`SelectionPanel` resolves them per node, `PrefsForm` and labkit's
`ControlPanel` against their values. `prefClampNumber` holds a number to a
leaf's range.
