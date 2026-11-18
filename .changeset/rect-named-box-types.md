---
'@weasel-js/geom': major
'@weasel-js/renderer': major
'@weasel-js/core': major
---

`FramedBox`, `WarpBox` and `MeshBox` are `FramedRect`, `WarpRect` and `MeshRect`, since each is an `{ x, y, width, height }`.

geom names that shape `Rect` and keeps `Box` for a min/max pair. `FramedBox` and `WarpBox` are geom's; `MeshBox` is renderer's.

```ts
// before
import type { FramedBox, WarpBox } from '@weasel-js/geom';
// after
import type { FramedRect, WarpRect } from '@weasel-js/geom';
```

<!-- entry: breaking api -->
