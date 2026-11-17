---
'@weasel-js/renderer': major
'@weasel-js/core': major
---

`resolveFillPattern` is renamed `resolvePaintPattern`: it resolves any paint's pattern, a stroke's included.

```ts
// before
const paint = resolveFillPattern(posed);
// after
const paint = resolvePaintPattern(posed);
```

<!-- entry: breaking api -->
