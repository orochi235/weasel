---
'@weasel-js/core': major
---

`useAutoCenter` is `useFitOnce`: it fits the zoom and centers, once.

```ts
// before
useAutoCenter(width, height, contentW, contentH, setZoom, setPan);
// after
useFitOnce(width, height, contentW, contentH, setZoom, setPan);
```

<!-- entry: breaking api -->
