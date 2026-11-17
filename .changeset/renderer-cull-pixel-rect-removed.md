---
'@weasel-js/renderer': major
'@weasel-js/core': major
---

`CullRect` and `PixelRect` are removed; `cullDrawCommands` and `readPixels` take geom's `Rect`, which has the same fields.

```ts
// before
import type { CullRect } from '@weasel-js/renderer';
const view: CullRect = { x: 0, y: 0, width: 800, height: 600 };
// after
import type { Rect } from '@weasel-js/geom';
const view: Rect = { x: 0, y: 0, width: 800, height: 600 };
```

<!-- entry: breaking api -->
