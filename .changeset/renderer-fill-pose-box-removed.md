---
'@weasel-js/renderer': major
'@weasel-js/core': major
---

`FillPoseBox` is removed; the paint-unit functions and paint-kind hooks take geom's `Rect`, which has the same fields.

```ts
// before
import type { FillPoseBox } from '@weasel-js/renderer';
const box: FillPoseBox = { x: 0, y: 0, width: 10, height: 10 };
// after
import type { Rect } from '@weasel-js/geom';
const box: Rect = { x: 0, y: 0, width: 10, height: 10 };
```

<!-- entry: breaking api -->
