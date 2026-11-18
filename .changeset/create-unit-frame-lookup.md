---
'@weasel-js/core': major
---

`unitFrameAt` is `createUnitFrameLookup`: it takes a scene, precomputes its boxes and returns the lookup.

```ts
// before
const frameAt = unitFrameAt(scene);
// after
const frameAt = createUnitFrameLookup(scene);
```

<!-- entry: breaking api -->
