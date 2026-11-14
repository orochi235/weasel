---
'@weasel-js/core': minor
---

`pathMotion(path, options)` moves a node along a path: hand it to `tweenPose` as `geometry`, with `to: motion.at(pose, 1)`.

```ts
const motion = pathMotion(path, { orient: true });
tweenPose(animator, adapter, { id, to: motion.at(pose, 1), geometry: motion, ms: 2000 });
```

The move travels by length, so easing shapes the speed along the path. `anchor` names the point of the pose that rides it, as fractions of its bounds (default the center); `orient` turns the pose with the tangent, plus `rotationOffset` radians; `descriptor` reads and writes the pose (default `RECT_POSE_DESCRIPTOR`). `path` may also be a two-component length table. Its `lerp` works as a sampled track's `interpolate` too.

<!-- entry: rank=10 api new -->
