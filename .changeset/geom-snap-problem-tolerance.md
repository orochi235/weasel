---
'@weasel-js/geom': major
---

`SnapProblem`'s on-the-locus tolerance is named `tolerance`, like every other geom options bag, not `eps`.

```ts
// before
resolveSnap({ ...problem, eps: 1e-4 });
// after
resolveSnap({ ...problem, tolerance: 1e-4 });
```

<!-- entry: breaking -->
