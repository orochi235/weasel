---
'@weasel-js/diagram': major
---

diagram's preset factories are `createReorderPreset` and `createGroupReorderPreset`, so they no longer clash with core's `reorderPreset`.

```ts
// Before
import { reorderPreset, groupReorderPreset } from '@weasel-js/diagram';
features={['move', reorderPreset(opts), groupReorderPreset(report)]}

// After
import { createReorderPreset, createGroupReorderPreset } from '@weasel-js/diagram';
features={['move', createReorderPreset(opts), createGroupReorderPreset(report)]}
```

<!-- entry: breaking api -->
