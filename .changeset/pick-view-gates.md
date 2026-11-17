---
'@weasel-js/core': major
---

`RegionPickView` and its alias `HitTestView` are one type, `PickingView`: the view any pick consults.

```ts
// before
import type { HitTestView, RegionPickView } from '@weasel-js/core';
// after
import type { PickingView } from '@weasel-js/core';
```

<!-- entry: breaking api -->
