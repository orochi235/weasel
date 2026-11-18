---
'@weasel-js/core': major
---

`pickTopMostHit` is renamed `topmostOf`, and its `PickTopMostHitAdapter` type `TopmostTree`. It reduces an already-hit id list to the one a click acts on and does no hit test of its own.

```ts
// before
import { pickTopMostHit, type PickTopMostHitAdapter } from '@weasel-js/core';
// after
import { topmostOf, type TopmostTree } from '@weasel-js/core';
```

<!-- entry: breaking -->
