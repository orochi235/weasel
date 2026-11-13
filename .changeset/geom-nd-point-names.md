---
'@weasel-js/geom': major
---

`@weasel-js/geom/nd` names its point helpers as the root barrel and `./3d` do: `lerpPoint` and `cubicPointAt`, not `lerp` and `cubicAt`.

```ts
// before
import { cubicAt, lerp } from '@weasel-js/geom/nd';
// after
import { cubicPointAt, lerpPoint } from '@weasel-js/geom/nd';
```

<!-- entry: breaking -->
