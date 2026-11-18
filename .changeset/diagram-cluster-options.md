---
'@weasel-js/diagram': major
---

`diagramScene`'s `groupPadding` and `groupStyle` options are `clusterPadding` and `clusterStyle`.

```ts
// before
diagramScene(data, { groupPadding: 16, groupStyle: (g) => style });
// after
diagramScene(data, { clusterPadding: 16, clusterStyle: (c) => style });
```

<!-- entry: breaking api -->
