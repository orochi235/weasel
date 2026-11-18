---
'@weasel-js/gestures': major
---

The `LogicalMod` type is gone; it repeated `ModifierKey`, which `LogicalModSpec.name` now takes.

```ts
// before
import type { LogicalMod } from '@weasel-js/gestures';
// after
import type { ModifierKey } from '@weasel-js/gestures';
```

<!-- entry: breaking api -->
