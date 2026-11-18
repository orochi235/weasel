---
'@weasel-js/diagram': major
---

`ForceOptions.groupStrength`, how hard a cluster draws its members together, is `clusterStrength`.

```ts
// before
force(graph, { groupStrength: 0.4 });
// after
force(graph, { clusterStrength: 0.4 });
```

<!-- entry: breaking api -->
