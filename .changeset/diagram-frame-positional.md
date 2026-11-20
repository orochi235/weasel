---
'@weasel-js/diagram': major
---

`layoutPoses`, `bodyFollower`, `waypointFollower` and `documentBoundsOf` take a `LayoutFrame` where they took a `PoseDescriptor`.

This is breaking for a caller that passed its own descriptor in that position. Wrap it with `layoutFrameOf`:

```ts
// before
waypointFollower(scene, descriptor);
// after
waypointFollower(scene, layoutFrameOf(descriptor));
```

<!-- entry: breaking api -->
