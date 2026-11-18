---
'@weasel-js/kernel3d': major
---

kernel3d's `ScreenBox` is renamed `ScreenRect`: its shape is geom's `Rect`, and geom calls a min/max corner pair a box.

Only the name changes; the shape is the same, so a rename at each import is the whole migration.

```ts
// before
import type { ScreenBox } from '@weasel-js/kernel3d';
// after
import type { ScreenRect } from '@weasel-js/kernel3d';
```

<!-- entry: breaking api -->
