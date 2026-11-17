---
'@weasel-js/diagram': major
---

`DiagramGroup`, `DataGroup` and `GraphGroup` are `DiagramCluster`, `DataCluster` and `GraphCluster`.

The box holds a `members` list, which in weasel is a cluster, never a group.

The rest of the family follows: `GroupInset` → `ClusterInset`, `DEFAULT_GROUP_INSET` → `DEFAULT_CLUSTER_INSET`, `expandGroupEdges` → `expandClusterEdges`, `diagramGroupOf` → `diagramClusterOf`, `DIAGRAM_GROUP` → `DIAGRAM_CLUSTER`, `GROUP_DERIVE_POSE` → `CLUSTER_DERIVE_POSE`, `groupDerivePose` → `clusterDerivePose`, `GroupPoseOptions` → `ClusterPoseOptions`, `groupLabelIdOf` → `clusterLabelIdOf` and `DEFAULT_GROUP_STYLE` → `DEFAULT_CLUSTER_STYLE`. Data is unchanged: `DiagramData.groups`, the trait's `group` field and the `'diagram:group'` derivation key keep their names, so saved diagrams load as before.

```ts
// before
const box: DataGroup = { id: 'g', members: ['a', 'b'] };
const trait = diagramGroupOf(node);
// after
const box: DataCluster = { id: 'g', members: ['a', 'b'] };
const trait = diagramClusterOf(node);
```

<!-- entry: breaking api -->
