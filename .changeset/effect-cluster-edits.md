---
'@weasel-js/diagram': major
---

The effect pipeline's cluster edits are named for clusters, from `clusterStages` and `dissolveCluster` to `uniqueClusters`.

`groupStages`, `ungroup`, `renameGroup`, `moveToGroup`, `setGroupBox`, `moveGroup`, `groupContents`, `nextGroupId` and `uniqueGroups` are `clusterStages`, `dissolveCluster`, `renameCluster`, `moveToCluster`, `setClusterBox`, `moveCluster`, `clusterContents`, `nextClusterId` and `uniqueClusters`. Their arguments are unchanged; a new cluster's id is `cluster`, `cluster-2`, and so on.

```ts
// before
import { groupStages, ungroup } from '@weasel-js/diagram/effect';
const next = ungroup(groupStages(doc, ['a', 'b']), 'outer');
// after
import { clusterStages, dissolveCluster } from '@weasel-js/diagram/effect';
const next = dissolveCluster(clusterStages(doc, ['a', 'b']), 'outer');
```

<!-- entry: breaking api -->
