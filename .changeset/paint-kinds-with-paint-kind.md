---
'@weasel-js/core': major
---

`switchGradientKind` is renamed `withPaintKind`, and comes from `@weasel-js/paint-kinds`.

It is `withGradientKind` one level up, retargeting a paint to any kind with a stop list.

```ts
// before
import { switchGradientKind } from '@weasel-js/core';
const next = switchGradientKind(paint, 'conic-gradient');
// after
import { withPaintKind } from '@weasel-js/paint-kinds';
const next = withPaintKind(paint, 'conic-gradient');
```

<!-- entry: breaking api -->
