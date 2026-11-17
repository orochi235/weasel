---
'@weasel-js/ui': major
---

`useAsyncOptions`'s options type is `UseAsyncOptionsOptions`, where it was `UseAsyncOptionsProps`, matching every other hook's `Use…Options`.

```ts
// before
import type { UseAsyncOptionsProps } from '@weasel-js/ui';
// after
import type { UseAsyncOptionsOptions } from '@weasel-js/ui';
```

<!-- entry: breaking api -->
