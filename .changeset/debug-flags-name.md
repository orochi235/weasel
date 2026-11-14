---
'@weasel-js/core': major
---

`DebugConfig` is now `DebugFlags`, the type `parseDebugFlags` returns and `SceneCanvas`'s `debug` prop takes.

```ts
// before
const debug: DebugConfig = { hitboxes: true };
// after
const debug: DebugFlags = { hitboxes: true };
```

<!-- entry: breaking api -->
