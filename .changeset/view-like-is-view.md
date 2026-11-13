---
'@weasel-js/renderer': major
'@weasel-js/core': major
---

`ViewLike` is gone; it was geom's `View` under a second name, and every barrel that exported it exports `View`.

That is `@weasel-js/renderer`, `@weasel-js/core` and `@weasel-js/core/renderer`.

```ts
// before
import type { ViewLike } from '@weasel-js/renderer';
// after
import type { View } from '@weasel-js/renderer';
```

<!-- entry: breaking -->
