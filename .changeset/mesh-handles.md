---
'@weasel-js/core': patch
'@weasel-js/ui': patch
---

Mesh gradients get on-canvas handles. `MeshHandles` (`@weasel-js/ui`) draws every patch corner, edge control and tensor interior point over the patch outlines, previews through `onInput` and commits once per drag; dragging a corner carries its controls, and points two patches share move as one handle so the seam does not tear. `SceneGradientHandles` now shows them for a node whose slot holds a mesh, committing through `setFill` / `setStroke` in the bounds frame like the three gradients. The geometry is public on `@weasel-js/core/mesh` as `meshHandles`, `moveMeshHandle` and `meshGuides`. Additive; `GradientHandles`' behavior is unchanged.
