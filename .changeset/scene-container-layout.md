---
"@weasel-js/core": patch
"@weasel-js/guides": patch
---

A container can declare its layout on the scene: `scene.add({ kind: 'container',
layout: tileGrid(...) })`, or `layoutKey` in a snapshot, resolved through the new
`SceneRegistry.layout`. Layouts now answer to every change to a container's
children, not only arrivals: a delete, reorder or resize re-runs the strategy's
`childPoses`, and the writes land in the same undo step as the change, so undo
restores the whole arrangement at once. A child that joins goes to `arrive` as
before, and to `childPoses` when the strategy has no `arrive`.

This runs through the scene's existing arrival window and `arrange` op; there is
one layout pass (`core/scene/layoutPass.ts`) whether the layout is declared on
the node or supplied by `<SceneCanvas layouts>` / `useLayoutArrivals`, and a
declared layout wins. With no handler installed, a scene holding declared
layouts runs that pass itself, measured by the new
`UseSceneOptions.layoutFrame` (also a `sceneFromJSON` option).

Breaking edges: `SceneArrivalHandler` gains a second argument, `changed`, and is
now also called for edits with no arrivals. While layouts are active, a bare
`scene.remove`, `scene.reorder`, or a `setPose` that resizes a container is
recorded as a one-mutation batch, like `add` and `move` already were. The
`arrange` op's coalesce key now names the nodes it moved.

Also new: `scene.layoutOf(id)` and `scene.onReflow(listener)`, which reports each
live edit's layout writes; `<SceneCanvas reflowTransition>` uses it to glide
those reflows as it does a drag's. New exports: `LayoutFrame`, `LayoutMove`.
