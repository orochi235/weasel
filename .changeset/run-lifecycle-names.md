---
'@weasel-js/core': major
'@weasel-js/editing': major
---

The move, resize and rotate options' `onGestureStart` and `onGestureEnd` are `onRunStart` and `onRunEnd`.

`GestureLifecycleOptions` is `RunLifecycleOptions`: the lifecycle is the action run's, not a gesture's.

The helpers follow: `readGestureLifecycle`, `gestureLifecycleParams`, `commitGestureOps` and `closeGesture` are `readRunLifecycle`, `runLifecycleParams`, `commitRunOps` and `closeRun`.

```ts
// before
<SceneCanvas selectTool={{ move: { onGestureStart: save, onGestureEnd: done } }} />
// after
<SceneCanvas selectTool={{ move: { onRunStart: save, onRunEnd: done } }} />
```

<!-- entry: breaking api -->
