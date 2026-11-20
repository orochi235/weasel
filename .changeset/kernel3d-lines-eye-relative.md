---
'@weasel-js/kernel3d': minor
---

Lines far from the world's origin draw where they are and hold still as the camera moves, packed against the eye with `cameraFrame`.

`packLines(lines, origin)` subtracts `origin` from every position in doubles before writing float32, and `cameraFrame(camera, aspect, up?, origin?)` gives the view-projection relative to the same point (default the eye) along with the camera's depth. A line at Earth's radius that stepped by half a meter now draws to a fraction of a millimeter. A buffer can be packed once against a fixed point near its lines and drawn under `cameraFrame(camera, aspect, up, thatPoint)` each frame. Without an origin, `packLines` and `cameraViewProjection` work as before.

```ts
const frame = cameraFrame(camera, width / height);
pass.draw(packLines(lines, frame.origin), frame.viewProjection, size, { logDepth: frame.logDepth });
```

<!-- entry: rank=10 new api fix -->
