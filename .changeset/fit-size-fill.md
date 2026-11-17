---
'@weasel-js/core': major
---

`computeFitViewport` is gone: `fitSize` takes a `fill`, the fraction of each axis the content may take, and does the same fit.

```ts
// before
const fit = computeFitViewport(width, height, contentW, contentH, 0.85);
// after
const fit = fitSize(width, height, contentW, contentH, 0, undefined, 0.85);
```

<!-- entry: breaking api -->
