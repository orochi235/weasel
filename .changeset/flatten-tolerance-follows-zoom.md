---
'@weasel-js/renderer': patch
'@weasel-js/core': patch
---

Curves on the live canvas now flatten against the zoom. `flattenTolerance` on
`WeaselRenderer`, `<Canvas>`, and `<SceneCanvas>` accepts `{ px }` in device
pixels as well as a world length, and defaults to `{ px: 0.5 }`: each path is
flattened to stay within half a device pixel under the transform it draws
with, so a curve at 8x no longer shows 4 px facets, and a scene whose world
unit is not a pixel no longer needs a tolerance of its own. The tolerance is
snapped down to a power of two and fill meshes are cached per tolerance, so a
continuous zoom rebuilds a path's mesh once per octave rather than every frame;
a fixed world tolerance is now cached too instead of tessellated every frame.
`renderSceneToPixels` resolves its `flattenTolerancePx` the same way.
