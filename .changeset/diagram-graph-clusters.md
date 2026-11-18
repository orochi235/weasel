---
'@weasel-js/diagram': major
---

A layout's `Graph` holds its boxes in `clusters`, which was `groups`, and a `GraphNode` names the one it is in with `cluster`, which was `group`.

```ts
// before
const inside = graph.groups?.find((g) => g.id === node.group);
// after
const inside = graph.clusters?.find((c) => c.id === node.cluster);
```

<!-- entry: breaking api -->
