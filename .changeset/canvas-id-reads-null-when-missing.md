---
'@weasel-js/core': major
---

`pickAt` and `readIds` on a canvas's ref answer `null` when there is no frame to read, instead of 0 or an empty buffer.

That covers before the first paint, a lost context, and a render worker that gave no answer; `readIdsSync` answers `null` for these too. On `<SceneCanvas worker>`, a read answers `null` when any canvas of the stack has no ids.

```ts
// before
const id = await ref.current.pickAt(x, y); // 0 when nothing could be read
// after
const id = await ref.current.pickAt(x, y);
if (id === null) return; // nothing could be read: not the same as nothing hit
```

<!-- entry: rank=5 breaking api -->
