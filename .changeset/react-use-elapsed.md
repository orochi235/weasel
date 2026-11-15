---
'@weasel-js/react': minor
---

`useElapsedRaf` and `useElapsed()` give a frame loop the milliseconds it has run, leaving out time spent hidden or out of view.

```ts
const loop = useElapsedRaf((elapsedMs, self) => { self.request(); draw(elapsedMs); }, { target: canvasRef });
const seconds = useElapsed() / 1000;
```

A loop no longer needs its own `onResume` rebase to keep a background tab's hour from arriving as one frame; one passed in still runs.

<!-- entry: api -->
