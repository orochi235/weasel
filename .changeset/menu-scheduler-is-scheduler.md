---
'@weasel-js/menu': major
---

`MenuScheduler` is gone: `@weasel-js/menu` re-exports ui-input's `Scheduler`, which it was an alias of.

`MenuControllerOptions.scheduler` takes one.

```ts
// before
import type { MenuScheduler } from '@weasel-js/menu';
// after
import type { Scheduler } from '@weasel-js/menu';
```

<!-- entry: breaking api -->
