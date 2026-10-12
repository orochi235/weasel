---
'@weasel-js/ui': patch
---

Fixes: in a `LayerList` with cards, the one-line rows under a card and the rows mixed in among cards were `role="row"` with no `treegrid` above them. The rows under a card are now a `treegrid` named for the card, and each run of consecutive rows among cards is a `treegrid` named for the card above the level, or by the list's own `label` at the top level. `aria-level` counts from 1 inside each. A list with no cards is one `treegrid`, as before.

Adds API: `groupSelector` on `useReorderDragList`, a selector for children of the container that only wrap rows, so a list can group a run of rows without the drag counting the group as one row.
