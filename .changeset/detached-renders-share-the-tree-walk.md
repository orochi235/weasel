---
'@weasel-js/core': patch
---

Detached scene renders now honor layer visibility and container clips.

`buildSceneViewCommands` walked `scene.renderOrder()` and painted every node it
found. That walk knew nothing about scene layers or parentage, so
`<SceneViewCanvas>`, `<MinimapCanvas>` and `renderSceneToPixels` all painted
nodes on hidden layers and let a container's children spill past the container.
The main canvas got both right, because `buildSceneLayer` goes through
`buildSceneTree`.

The detached path now goes through `buildSceneTree` too, which is the dedupe the
detached-minimap spec called for. One walk, so the two surfaces cannot disagree
again.

Output nesting follows `buildSceneTree`: the view group holds one group per
**visible** scene layer, each holding one group per node. Code that indexed the
view group's children as one-per-node — `commands[0].children[i]` — now finds a
layer group there and needs a further hop. `extraCommands` still come last,
beside the layer groups.

A hand-written `Scene` stand-in must now supply `layers`, `roots`, and
`children` on containers; scenes from `createScene` and `sceneFromJSON` already
do.
