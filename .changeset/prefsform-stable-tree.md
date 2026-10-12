---
'@weasel-js/ui': patch
---

`PrefsForm` no longer rebuilds the tree it draws each time it is handed a new `values` object. Since conditions were applied, an owner passing `values` inline got a new tree on every render, and a drag over the form then drew no drop for one render and rendered again on every pointer move.
