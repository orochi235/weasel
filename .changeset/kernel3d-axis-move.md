---
'@weasel-js/kernel3d': minor
---

A 3D host can drag the selection along any world axis, up included, from red, green and blue handles the kernel lays out and hit-tests.

`createAxisMove(world, { selection })` returns the `move3d.axis` action, a `contribution` binding a drag on a handle to it, `handleAt` for the dispatcher's `affordanceAt`, and `handles(viewport)` to draw. The move previews, snaps along the axis through `createSnap`, and commits as one undo step.

```ts
const axisMove = createAxisMove(world, { selection });
useGestureDispatcher({ …, affordanceAt: axisMove.handleAt });
// register axisMove.contribution beside the canvas's other ambient entries
```

<!-- entry: rank=10 new api -->
