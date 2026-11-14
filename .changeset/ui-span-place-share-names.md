---
'@weasel-js/ui': major
---

ui's `toFraction` and `spanFraction` are now `spanPlace` and `spanShare`, the names `@weasel-js/ui-input` gives the same two functions.

```ts
// before
import { toFraction, spanFraction } from '@weasel-js/ui';
// after
import { spanPlace, spanShare } from '@weasel-js/ui';
```

<!-- entry: breaking api -->
