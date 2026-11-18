---
'@weasel-js/gestures': major
---

The `ModifiersEvent` type is gone; it repeated `EventModifiers` field for field, and `matchModifiers` and `historyKey` take that.

```ts
// before
import type { ModifiersEvent } from '@weasel-js/gestures';
// after
import type { EventModifiers } from '@weasel-js/gestures';
```

<!-- entry: breaking api -->
