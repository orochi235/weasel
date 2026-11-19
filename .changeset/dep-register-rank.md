---
'@weasel-js/routing': minor
---

Dep sources can be ranked: `register` takes a `rank`, and `<DepRank>` ranks every source beneath it.

A tier of sources stays over a lower one whatever order they mounted in.

```tsx
<DepRank rank={1}>
  <PluginDeps />
</DepRank>
```

Sources under one name stack by rank, then by age; the default is 0. `rankedDepRegistry(registry, rank)` is the same without React.

<!-- entry: api -->
