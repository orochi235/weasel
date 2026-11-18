---
'@weasel-js/core': major
---

`fitToBounds` is `fitSize`, since it fits a content size and takes no bounds; `fitViewToBounds` is the one that takes bounds.

```ts
// before
const fit = fitToBounds(width, height, contentW, contentH, 16);
// after
const fit = fitSize(width, height, contentW, contentH, 16);
```

<!-- entry: breaking api -->
