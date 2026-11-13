---
'@weasel-js/geom': major
---

`@weasel-js/geom/3d` names its point helpers the way the root barrel does: `lerpPoint`, `cubicPointAt` and `pointAtLength`, and it gains `distance2`.

`lerp` read as the root barrel's scalar `lerp`, and the `3` on `pointAtLength3` repeated what the subpath already says.

```ts
// before
import { cubicAt, lerp, pointAtLength3 } from '@weasel-js/geom/3d';
// after
import { cubicPointAt, lerpPoint, pointAtLength } from '@weasel-js/geom/3d';
```

<!-- entry: breaking api -->
