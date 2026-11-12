---
'@weasel-js/kernel3d': minor
---

A camera can orbit about the world's `up`, so a z-up world keeps its horizon level.

`Camera3d` takes an optional `up`, default +y. Give it the same axis as `World3d.up`; orbit, pan, dolly, the view matrix and a 3D view's aim all turn about it. At yaw 0 the eye sits where the turn carrying +y onto `up` carries +z: down -y when z is up.

```ts
const UP = { x: 0, y: 0, z: 1 };
const camera = createCamera({ distance: 10, pitch: 0.4, up: UP });
const world = { scene, viewport, up: UP };
```

`cameraBasis(camera)` returns the eye and the camera's forward, right and up directions in world terms.

<!-- entry: rank=5 new api fix -->
