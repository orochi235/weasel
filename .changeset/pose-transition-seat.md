---
"@weasel-js/core": patch
---

`<SceneCanvas poseTransition>` glides the poses a scene writes on screen instead of snapping them:
a button's `scene.setPose`, an undo, a redo, and with `enter` a node the scene adds. It takes the
same kind of transition as `reflowTransition` (`useAnimatedReflow`), and `glides` picks which
writes move — by default direct scene calls and history steps, not an action's commit. The
document takes each write at once; only what is shown travels.

`scene.onPoseWrite(listener)` is new: once per change, it reports each node whose pose the change
wrote or that it added, with the pose it left, where the write came from (`'call'`, `'ops'`,
`'undo'`, `'redo'`, `'layout'` or `'untracked'`), and the edit's label. Also new:
`bindPoseTransition`, `usePoseTransition`, `glidesByDefault`, and the `PoseWrite`,
`PoseWriteOrigin`, `ScenePoseReports`, `PoseTransitionSeat` and `PoseTransitionScene` types.
