---
'@weasel-js/diagram': major
---

diagram's preset factories are `createReorderPreset` and `createClusterReorderPreset`, so they no longer clash with core's `reorderPreset`.

```ts
// Before
import { reorderPreset, groupReorderPreset } from '@weasel-js/diagram';
features={['move', reorderPreset(opts), groupReorderPreset(report)]}

// After
import { createReorderPreset, createClusterReorderPreset } from '@weasel-js/diagram';
features={['move', createReorderPreset(opts), createClusterReorderPreset(report)]}
```

<!-- entry: breaking api -->
