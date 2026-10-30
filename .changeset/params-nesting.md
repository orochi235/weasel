---
'@weasel-js/prefs': patch
'@weasel-js/ui': patch
'@weasel-js/labkit': patch
---

`SelectionPanel` keeps a section nested in another as the schema writes it, where it used to fold its rows into the
top-level section: a nested `tab` joins a strip, a `panel` is boxed, and any other section draws under a heading of
its own, in its place among the rows. `PanelSection.rows` is replaced by `items`, its rows and nested sections in
order; `panelRowsOf` reads every row of a section and `isPanelSection` tells a nested section from a row. Each
`PanelSection` also carries `path`, the path its conditions name it by. A nested section is marked by its key when
selected, as a top-level one is.

A tab with no row to draw is left out of its strip on every params surface, and neither it nor anything else that
draws nothing splits the strip. `prefTabRuns` takes the rule as an optional `draws` predicate. `PrefsPane` now
leaves out such a tab too, except in a form given `showEmpty`; `WalkCtx` gains `showHidden` and `keepEmpty` for it.
