---
'@weasel-js/forge': major
---

`ComponentDeps` and `DepGraph` are renamed `ComponentNode` and `ComponentGraph`. They hold a component's source and history as well as its import links.

```ts
// before
const graph: DepGraph = await load(); const node: ComponentDeps = graph[title];
// after
const graph: ComponentGraph = await load(); const node: ComponentNode = graph[title];
```

<!-- entry: breaking api -->
