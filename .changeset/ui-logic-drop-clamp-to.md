---
'@weasel-js/ui-logic': major
---

ui-logic's deprecated `clampTo` is removed; use `clamp` from `@weasel-js/geom`, which takes the same arguments.

```ts
// before
import { clampTo } from '@weasel-js/ui-logic';
// after
import { clamp } from '@weasel-js/geom';
```

<!-- entry: breaking -->
