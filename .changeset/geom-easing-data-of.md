---
'@weasel-js/geom': minor
---

`easingDataOf(name)` returns a named easing as data: its cubic-bezier control points, or its `linear()` points.

A curve is stored as `linear()` points where no single cubic fits it within 0.003.

```ts
easingDataOf('easeOutBack');   // { bezier: [0.33333, 1.56725, 0.66673, 0.99994] }
easingDataOf('easeOutBounce'); // { linear: [[0, 0], …, [1, 1]] }
```

<!-- entry: api new -->
