---
'@weasel-js/labkit': major
---

labkit's `indexedDbAdapter` is `labIndexedDbAdapter`, apart from storage's `indexedDbAdapter`, which keeps another database.

This is a breaking rename, with no alias. It is the same adapter over labkit's own `labkit` database, so saved labs read as before.

```ts
// before
import { indexedDbAdapter } from '@weasel-js/labkit';
// after
import { labIndexedDbAdapter } from '@weasel-js/labkit';
```

<!-- entry: breaking api -->
