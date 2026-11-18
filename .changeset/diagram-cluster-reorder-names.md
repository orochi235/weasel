---
'@weasel-js/diagram': major
---

diagram's reorder for a cluster's members is `clusterReorderContribution` and `clusterReorderSlots`.

They were `groupReorderContribution` and `groupReorderSlots`, and take the same arguments.

```ts
// before
import { groupReorderContribution } from '@weasel-js/diagram';
ambient={[groupReorderContribution(report)]}
// after
import { clusterReorderContribution } from '@weasel-js/diagram';
ambient={[clusterReorderContribution(report)]}
```

<!-- entry: breaking api -->
