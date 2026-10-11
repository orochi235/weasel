---
'@weasel-js/ui': patch
---

`SelectionPanel` draws an `alias` leaf as the row of the leaf it points at, reading and writing that leaf's path, as `PrefsForm` does; it used to show `(alias: no renderer)`. An alias of nothing says so, and a renderer registered for the `alias` kind still gets the leaf as written. `PanelLeaf` gains an optional `own`: an alias's own key, where its `path` is its target's. In `PrefSchemaEditor`, removing a pref also removes its aliases.
