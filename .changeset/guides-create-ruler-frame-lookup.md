---
'@weasel-js/guides': major
---

`rulerFrameAt` is `createRulerFrameLookup`: it builds, over a scene, a lookup of the frame a ruler reads in at a point.

```ts
// before
const frameAt = rulerFrameAt(scene, root);
// after
const frameAt = createRulerFrameLookup(scene, root);
```

<!-- entry: breaking api -->
