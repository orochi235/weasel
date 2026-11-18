---
'@weasel-js/diagram': major
---

`SeqRect` (`@weasel-js/diagram`) and `EffectBox` (`@weasel-js/diagram/effect`) are gone; both are geom's `Rect`, the same `x`, `y`, `width`, `height`.

```ts
// before
import type { SeqRect } from '@weasel-js/diagram';
// after
import type { Rect } from '@weasel-js/geom';
```

<!-- entry: breaking api -->
