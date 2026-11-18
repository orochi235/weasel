---
'@weasel-js/diagram': major
---

The layout helper that turns world placements into moves, dropping pinned and unmoved nodes, is `movesFrom`.

`translated` is renamed `movesFrom`; its arguments are unchanged.

```ts
// before
return translated(graph, placed, pinnedSet(graph, opts), opts.tolerance);
// after
return movesFrom(graph, placed, pinnedSet(graph, opts), opts.tolerance);
```

<!-- entry: breaking api -->
