---
'@weasel-js/diagram-elk': major
---

`ElkPlan.groups`, the boxes ELK left room for, is `ElkPlan.clusters`.

```ts
// before
const box = (await elkPlan(graph)).groups.get('G');
// after
const box = (await elkPlan(graph)).clusters.get('G');
```

<!-- entry: breaking api -->
