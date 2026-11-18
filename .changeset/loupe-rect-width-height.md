---
'@weasel-js/loupe': major
---

`LoupeRect` is geom's `Rect`: a lens' rectangle names its size `width` and `height`.

```ts
// before
const lens: LoupeRect = { x: 0, y: 0, w: 192, h: 192 };
// after
const lens: LoupeRect = { x: 0, y: 0, width: 192, height: 192 };
```

<!-- entry: breaking api -->
