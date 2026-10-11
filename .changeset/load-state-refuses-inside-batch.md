---
'@weasel-js/core': patch
---

`scene.loadState` called inside `scene.untracked` or `scene.batch` left the scene unable to group edits: every later `batch` recorded one undo step per op, and declared layouts stopped arranging bare edits. `loadState` now throws there, since it replaces the state those calls would revert to. It also drops selected ids the snapshot does not hold and clears every pose override, so neither carries over onto a node that reuses an id.
