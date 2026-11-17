---
'@weasel-js/core': minor
---

Core exports `shownLookup`, `nodesAsShown`, `requiresOperands`, `SNAP_ROLE_MODS` and `spanSnap`, which a package's own actions and tools build on.

`shownLookup(scene)` and `nodesAsShown(overrides, nodes)` read nodes with the data a gesture's override shows them with, as `nodeAsShown` reads one. `requiresOperands` is the `enabled` check for an action that needs a selection. `SNAP_ROLE_MODS` are the snap modifiers a snapping drag binding lets be held from the press, and `spanSnap(snapDep)` snaps both ends of a two-point gesture.

<!-- entry: api -->
