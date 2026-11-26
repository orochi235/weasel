---
'@weasel-js/geom': major
'@weasel-js/core': major
---

`cubicBezierEasing` is gone from geom and core: control points resolve through `resolveEasing`, which runs blits' cubic-bezier.

`resolveEasing` caches one curve per set of control points. Code that builds a curve per pointer move, where that cache would fill, calls blits' `curve` directly; it throws on an `x1` or `x2` outside 0..1, which `resolveEasing` clamps.

```ts
// before
const ease = cubicBezierEasing(0.4, 0, 0.2, 1);
// after
const ease = resolveEasing({ bezier: [0.4, 0, 0.2, 1] });
// or, uncached
import { curve } from '@msb235/blits';
const live = curve({ bezier: [0.4, 0, 0.2, 1] });
```

<!-- entry: breaking api -->
