---
"@weasel-js/core": patch
"@weasel-js/guides": patch
---

`tileGrid` takes an `overflow` policy, and it holds however a child arrives — dragged in, inserted, reparented, duplicated or grouped inside the grid. Before, only a drop was checked: a child that arrived by an op past `cols * rows` was skipped by the layout and left wherever its pose put it.

- `'reject'` (the default) refuses the child by every route. A drop finds no free cell, as before. An insert or reparent that would overfill the grid is now reverted whole, so nothing lands and no undo entry is recorded. **This is a behavior change:** such an op used to add the child and leave it unplaced.
- `'grow'` adds a row when the last one fills (a column, under `flow: 'column'`), and the container grows by one cell pitch to hold it, in the same undo step.
- `'scroll'` keeps the container's size and runs the extra children on past its last visible row at the same pitch. `LayoutStrategy.contentExtent` reports the region they cover.

Also new on `tileGrid`: `flow: 'row' | 'column'` sets the fill order. Every child now gets a cell from `childPoses`; one past the grid is placed past it rather than skipped. A child that joins a non-full grid by an op is placed in the free cell nearest to where it was put. Before, it stayed where its pose put it.

Underneath, the scene has an arrival hook. `scene.setArrivalHandler(fn)` hears every node that joins a container during one live edit. It returns poses to write as part of that edit, or `null` to refuse the edit. A refused `applyBatch` (or `history.applyOps`, or a journal's `applyBatch`) is reverted and does not throw. A refused `scene.batch`, `untracked`, or bare `add` / `move` is reverted and throws `SceneArrivalRefused`. Redo and a restored history replay the arrangement recorded the first time, through the new `'arrange'` op (`createArrangeOp`). `LayoutStrategy` gains the optional `arrive` and `contentExtent`. `layoutArrivalHandler(scene, { layouts })` connects a scene's layouts to the hook, and `<SceneCanvas layouts>` installs it. A canvas wired by hand through `sceneToAdapter({ layouts })` calls `useLayoutArrivals`. A reparent-on-drop the container refuses now leaves the drag uncommitted instead of throwing.

Mostly additive, with these breaking edges. The default-policy change above. `Scene` gains a required `setArrivalHandler`, so a hand-written `Scene` implementation has to add it. While a handler is installed, a bare `scene.add` / `scene.move` into a container is recorded as a one-mutation batch.
