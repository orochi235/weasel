---
'@weasel-js/paint': major
---

`Region` names its size `width` and `height`, not `w` and `h`.

```ts
// before
const region: Region = { x: 0, y: 0, w: 100, h: 50, shape: 'rectangle' };
// after
const region: Region = { x: 0, y: 0, width: 100, height: 50, shape: 'rectangle' };
```

<!-- entry: breaking api -->
