---
'@weasel-js/core': patch
---

`GeometryProjection.transform` takes a third argument, `change: PoseChange`, holding the node's stored pose before the action and the pose the action moved it to. Move, nudge, flip and resize commit pass it. A host whose poses are not planar, such as a `@weasel-js/kernel3d` scene, can now map its data-held geometry from `change`, where the plane affine `m` could not describe a 3D transform. `GeometryProjection` takes an optional pose type parameter, and `PoseChange` is exported. Existing two-argument implementations keep working.
