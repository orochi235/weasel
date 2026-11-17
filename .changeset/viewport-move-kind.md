---
'@weasel-js/routing': major
'@weasel-js/core': major
---

`ViewportGestureKind` is `ViewportMoveKind`, since its values `'pan'` and `'zoom'` are actions, not gestures.

```ts
// before
import type { ViewportGestureKind } from '@weasel-js/core';
// after
import type { ViewportMoveKind } from '@weasel-js/core';
```

<!-- entry: breaking api -->
