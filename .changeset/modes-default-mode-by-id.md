---
'@weasel-js/modes': major
---

The preset lookup `byId` is `defaultModeById`, so it no longer reads as the registry's `byId`, which finds the app's own modes too.

```ts
// before
import { byId } from '@weasel-js/modes';
const mode = byId('path-edit');
// after
import { defaultModeById } from '@weasel-js/modes';
const mode = defaultModeById('path-edit');
```

<!-- entry: breaking api -->
