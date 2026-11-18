---
'@weasel-js/ui-input': major
---

`@weasel-js/ui-input` no longer exports `Box`; `edgeScroll`, `headingCost` and `nearestToward` take geom's `Rect`, which has the same fields.

```ts
// before
import type { Box } from '@weasel-js/ui-input';
// after
import type { Rect } from '@weasel-js/geom';
```

<!-- entry: breaking api -->
