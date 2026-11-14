---
'@weasel-js/core': major
---

`DecayLoopConfig` is now `DecayLoopOptions`, the name of what `useDecayLoop`'s `start` and the view dep's `decay` take.

```ts
// before
import type { DecayLoopConfig } from '@weasel-js/core';
// after
import type { DecayLoopOptions } from '@weasel-js/core';
```

<!-- entry: breaking api -->
