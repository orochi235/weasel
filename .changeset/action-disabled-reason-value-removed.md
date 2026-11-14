---
'@weasel-js/routing': major
'@weasel-js/core': major
---

`ActionDisabledReasonValue` is gone; the type of one reason is `ActionDisabledReason`, the same name as the constant that lists them.

```ts
// before
import type { ActionDisabledReasonValue } from '@weasel-js/core';
// after
import type { ActionDisabledReason } from '@weasel-js/core';
```

<!-- entry: breaking api -->
