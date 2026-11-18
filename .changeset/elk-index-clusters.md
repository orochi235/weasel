---
'@weasel-js/diagram-elk': major
---

`ElkIndex.groups`, which maps ELK's compound-node ids back to the graph's clusters, is `ElkIndex.clusters`.

```ts
// before
const cluster = toElk(graph, options).index.groups.get(elkId);
// after
const cluster = toElk(graph, options).index.clusters.get(elkId);
```

<!-- entry: breaking api -->
