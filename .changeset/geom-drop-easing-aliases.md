---
'@weasel-js/geom': major
'@weasel-js/core': major
---

The `easeIn`, `easeOut` and `easeInOut` aliases are removed from geom and core; use `easeInQuad`, `easeOutQuad` and `easeInOutQuad`.

```ts
// before
import { easeOut } from '@weasel-js/geom';
// after
import { easeOutQuad } from '@weasel-js/geom';
```

<!-- entry: breaking -->
