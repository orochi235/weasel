---
'@weasel-js/kernel3d': patch
---

An `up` that leans off an axis only by rounding, such as `{ x: 0, y: 6e-17, z: 1 }` from rotating +y a quarter turn, is read as that axis. `createInsert`, the pose descriptor's `translate` and the 3D aim used to take the first nonzero component, so that `up` laid footprints along the wrong axes and held a dragged solid's y fixed in a z-up world.
