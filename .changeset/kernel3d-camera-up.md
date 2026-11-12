---
'@weasel-js/kernel3d': minor
---

The camera orbits about the world's `up`, so a z-up world keeps its horizon level.

`World3d.up` is the one place to set it: every dep, `screenBoxOf` and `createInsert` turn the camera about it. At yaw 0 the eye sits where the turn carrying +y onto `up` carries +z: down -y when z is up. Where no world is in reach, the axis is passed alongside the camera, default +y:

```ts
const UP = { x: 0, y: 0, z: 1 };
const world = { scene, viewport, up: UP };
const viewProjection = cameraViewProjection(camera, aspect, UP); // drawing
const camera3d: Camera3dDep = { get, set, size, up: () => UP };  // orbit, pan and dolly
projectPoint(p, { camera, width, height, up: UP });              // a viewport built by hand
```

`cameraEye`, `cameraView`, `panBy` and `dollyToward` take the same trailing axis, and `cameraBasis(camera, up)` returns the eye and the camera's forward, right and up directions in world terms.

<!-- entry: rank=5 new api fix -->
