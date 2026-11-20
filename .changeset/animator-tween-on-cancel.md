---
'@weasel-js/animator': minor
---

A tween takes an `onCancel`, which runs when it stops short of its end.

It runs on a cancel by handle, by `cancelKey` or by `cancelAll`, when another animation takes its key, and when a tick that threw retires it. Exactly one of `onDone` and `onCancel` runs.

```ts
animator.tween({ from: 0, to: 1, ms: 300, onTick, onDone: finish, onCancel: abandon });
```

<!-- entry: api -->
