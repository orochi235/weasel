---
"@weasel-js/core": patch
---

A container can declare its layout on the scene: `scene.add({ kind: 'container',
layout: tileGrid(...) })`, or `layoutKey` in a snapshot resolved through the new
`SceneRegistry.layout`. The scene re-applies the strategy's `childPoses` whenever
the container's child set or order changes, or its bounds change size, and
records the poses it writes in the same undo entry as the change — so an insert,
delete, reorder or resize inside a laid-out container is one undo step that
restores the whole arrangement. This is additive: a scene that declares no layout
records exactly what it did before.

New on `Scene`: `layoutOf(id)`; `holdLayout(ids, fn)`, which takes the
arrangement `fn` leaves as the resting one (moveAction's drop commit uses it, so a
drop still lands in the cell `commitDrop` picked); and `onReflow(listener)`, which
reports each recorded reflow's pose writes. `<SceneCanvas reflowTransition>` now
glides those reflows too, not only a drag's. `UseSceneOptions.layoutFrame` (and
the same `sceneFromJSON` option) says how bounds are read and poses composed for
layout. New exports: `LayoutFrame`, `LayoutMove`.

The `layout` dep, and `sceneToAdapter`'s `getLayout`, read a container's declared
layout first. `<SceneCanvas layouts>` and `sceneToAdapter({ layouts })` keep
working for containers that declare none, but drive drags only; both are
deprecated in favor of the node declaration.
