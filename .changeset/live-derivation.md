---
"@weasel-js/core": patch
---

What derives from a node now follows an anchor drag on it every frame, rather than at the release: a Text Along Path laid along a path or a blend from it, and the same for every other action that previews through its handle. `<SceneCanvas>` publishes each in-flight handle's `previewPose` and `previewData` to the scene's overrides through the new `publishPreviews(scene, dispatcher)`, and releases them once the handle's commit has landed, so a cancel leaves the document and its history untouched. A consumer driving a dispatcher of its own, a 3D host among them, can call it too.

A pose override can now carry `data(stored)`, the data a node is shown with, worked out from what it stores. Painting, picking, drawn bounds and the effective reading of every derivation read it through the new `nodeAsShown(overrides, node)`; the document reading, `scene.get`, history and export do not. `PoseOverride` and `PoseOverrides` take the scene's data type as a second parameter, and `PoseHold` gains `show(frame)`, which publishes data beside poses and leaves an id another writer holds to that writer.
