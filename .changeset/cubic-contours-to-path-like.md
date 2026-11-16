---
'@weasel-js/geom': major
---

`cubicContoursToPath` takes the path whose fill settings the result copies, instead of a fill rule.

The result keeps that path's `fillRule` and `openFill`, and is measured from an origin picked for its own points.

```ts
// before
cubicContoursToPath(contours, path.kind === 'polygon' ? path.fillRule : 'nonzero');
// after
cubicContoursToPath(contours, path);
```

<!-- entry: breaking -->
