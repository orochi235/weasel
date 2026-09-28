---
'@weasel-js/core': patch
---

The scene slot's `cull` option now skips painting nodes the view cannot see, rather than painting every node and dropping the off-screen commands afterward. It decides from the new scene-slot `paintBounds(node, pose, view)`, which `<SceneCanvas>` fills in with the new `defaultPaintBounds` whenever `drawOne` is `defaultDrawOne`. With any other `drawOne`, pass a `paintBounds` that encloses everything it paints — stroke spikes and markers included — or culling still only trims commands after painting. Nodes with no cheap bound are always painted: text, derived-path nodes, nodes with a `data.label` overlay, and any painter that does not declare one. `postProcess` now sees an empty group where a culled node would have painted.

A painter registered with `registerNodeShape` can declare `bounds(node, pose, ctx)`, the box its paint fits in before pose rotation; `findShapeBounds` reads it. The built-in shape, path, image and rect-fallback painters declare one.

`<SceneViewCanvas>` and `renderSceneToCanvas` take `cull` and `paintBounds` to do the same for a detached view, and `buildSceneViewCommands` takes a trailing `SceneViewCull`. `<MinimapCanvas>` shows the whole scene and does not cull.
