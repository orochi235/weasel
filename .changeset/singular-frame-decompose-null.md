---
'@weasel-js/core': major
'@weasel-js/kernel3d': major
---

`PoseComposition.decompose` answers `null` under a frame with no inverse, and every rebase built on it can answer `null` too.

A frame is singular when a 2D container's `transform` has no inverse geom's `invert` will give (a zero or collapsed axis, parallel columns, or a condition number past `1e12`), or a `Pose3` container's scale has a zero axis or one that far below the others. Storing such a frame stays valid, and `compose` still folds its children flat. `decomposeRigidPose`, `POSE3_COMPOSITION.decompose`, `rebaseLocalPose`, `PoseFrame.local` and `localUnder`, `GestureFrames.toLocal` and `toLocalUnder` return `null` there; `MoveCtx.followerOps` and `CloneEnd.copyOps` return `null` when a node would land in one; `NodeFrame` gains a required `inverts`. A custom composition's `decompose` may return `null` the same way.

```ts
// before
const local = composition.decompose(frame, world);
// after
const local = composition.decompose(frame, world);
if (local === null) return null; // refuse the edit: nothing stored there draws at `world`
```

<!-- entry: rank=10 breaking api -->
