---
'@weasel-js/core': patch
'@weasel-js/guides': patch
---

A container's layout is the one its scene node declares, and nothing else. The `layouts` prop of `<SceneCanvas>` and the `layouts` option of `sceneToAdapter` and `useSceneAdapter` are removed, along with `useLayoutArrivals`, `layoutArrivalHandler`, `LayoutSource`, and `LayoutArrivalOptions`, which existed to carry that map into the scene's layout pass.

Breaking: declare the layout on the node (`scene.add({ kind: 'container', layout })`) or set it with `scene.setLayout(id, layout)`, which is undoable. The scene's own layout pass arranges it, measured by `useScene({ layoutFrame })`; a canvas's `poseDescriptor` no longer measures a layout, so a scene whose poses are not rects passes `layoutFrame`. `scene.setArrivalHandler` is unchanged.
