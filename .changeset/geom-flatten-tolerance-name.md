---
'@weasel-js/geom': major
---

The path hit tests, `pathToMultiPolygon` and `pathFaceArrangement` call their flattening tolerance `flattenTolerance`.

That is its name in `tessellate`, `measurePath` and the stroke options.

`tolerance` stays the name for how far a fitted result may stray (`resamplePath`, `warpPath`, `simplifyPath`).

```ts
// before
pointInPath(path, x, y, { tolerance: 0.1 });
strokeHitTest(path, x, y, r, { tolerance: 0.1 });
pathToMultiPolygon(path, { tolerance: 0.1 });
// after
pointInPath(path, x, y, { flattenTolerance: 0.1 });
strokeHitTest(path, x, y, r, { flattenTolerance: 0.1 });
pathToMultiPolygon(path, { flattenTolerance: 0.1 });
```

<!-- entry: breaking -->
