---
'@weasel-js/labkit': minor
---

A config schema declares a curve with `f.curve`, and its settings row draws a `CurveField` the panel's width, where a drag is one undo step.

The value is flat, `[x0, y0, x1, y1, …]` over x in [0, 1]; `.range(min, max)` bounds y (default 0 to 1) and `.step` sets what a point snaps to (default 0.01). A lab no longer needs `f.custom('curve', …)` and a renderer of its own.

```ts
f.schema({ falloff: f.curve([0, 0, 1, 1]).range(-1, 1).step(0.05) });
```

<!-- entry: rank=5 new api -->
