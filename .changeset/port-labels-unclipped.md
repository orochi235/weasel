---
"@weasel-js/core": patch
"@weasel-js/diagram": patch
"@weasel-js/symmetry": patch
---

`DiagramView` now draws a node's perimeter port labels. A node's `portLabels` are children of its
container and sit outside its box, and a container clips its children to its painter's
silhouette, so every one of them was clipped away. `buildBody` now gives the container a `clipFromPose` that clips nothing.

Core exports that clip as `clipNothing` (from `@weasel-js/core` and `@weasel-js/core/math`),
for any container whose children may draw outside it. Every scene's registry carries it under
`CLIP_NOTHING`, so a container using it saves and loads with no registry entry of the consumer's.
A symmetry group now uses it too, and still saves under `SYMMETRY_CLIP_KEY`.
