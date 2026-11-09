---
'@weasel-js/core': patch
'@weasel-js/routing': patch
'@weasel-js/kernel3d': patch
---

Two 3D views on one surface each look through their own camera.

- `<CanvasView deps>` takes deps of the view's own, which actions dispatched inside it read in front of the surface's. A 3D host passes the `camera3d`, `nodeAtPoint` and `poseDescriptor` it built for that view's camera, so a press, a drag and an orbit in the view all use it. The view's camera, selection, `hitAt` and dispatcher stay its own.
- `<SceneCanvas geometry={{ pickEvery }}>` receives the view a pick is asked for as a second argument, whose new `viewId` field names it (`null` or absent for the surface). `RegionPickView` (`HitTestView`) carries the same field.
- An immediate action's params carry `viewId`, as `InvocationCtx` already did, and the select tool hands it to its `pickEvery` and `pickBest`.
- `Action.enabled` takes the view the event landed in as a fifth argument, `viewId`. `group.enter` picks through it, so a double-click in a view enters the group that view shows, and a hover in a view (`onHover`, `RuleCtx.hover`) names what that view shows.
- kernel3d's `ViewportSource` takes the view id it is asked for, and `createNodeAtPoint`, `createAreaSelect` and `createPoseDescriptor` take the view they serve, as does `createSnap` through its `viewId` option. The new `createPickEvery(world)` is the `geometry.pickEvery` for a 3D world, casting from the asking view's camera. A `viewport` function that took some other optional argument no longer fits `ViewportSource`.
