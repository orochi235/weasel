---
'@weasel-js/plot': major
---

`xyValueAt` takes the value scale and a position along it, rather than a layout and a 2D point.

This is a breaking change: the caller picks the coordinate that runs along the value axis.

```ts
// Before
xyValueAt(layout, point);
// After
xyValueAt(layout.value, layout.orientation === 'vertical' ? point.y : point.x);
```

<!-- entry: breaking api -->
