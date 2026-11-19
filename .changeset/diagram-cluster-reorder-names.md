---
'@weasel-js/diagram': major
---

diagram's reorder for a cluster's members is `createClusterReorderContribution` and `clusterReorderSlots`.

They were `groupReorderContribution` and `groupReorderSlots`, and take the same arguments.

```ts
// before
import { groupReorderContribution } from '@weasel-js/diagram';
ambient={[groupReorderContribution(report)]}
// after
import { createClusterReorderContribution } from '@weasel-js/diagram';
ambient={[createClusterReorderContribution(report)]}
```

<!-- entry: breaking api -->
