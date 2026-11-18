---
'@weasel-js/core': major
---

`ViewRect` names its size `width` and `height`, not `w` and `h`, in a `<CanvasView>`'s `bounds` and a minimap's `rect`.

It is now geom's `Rect`, as is a viewport layer's `bounds`.

```tsx
// before
<CanvasView id="pip" bounds={{ x: 8, y: 8, w: 240, h: 160 }} />
// after
<CanvasView id="pip" bounds={{ x: 8, y: 8, width: 240, height: 160 }} />
```

<!-- entry: breaking api -->
