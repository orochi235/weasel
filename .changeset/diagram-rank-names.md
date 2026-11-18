---
'@weasel-js/diagram': major
---

The two rankings `layered` and `chain` use are named for their algorithms: `simplexRanks` (network simplex) and `longestPathRanks`.

`ranksByLength` is renamed `simplexRanks` and `ranksOf` is renamed `longestPathRanks`; their arguments are unchanged.

```ts
// before
const ranks = ranksByLength(graph, backEdges(graph));
const plain = ranksOf(graph, backEdges(graph));
// after
const ranks = simplexRanks(graph, backEdges(graph));
const plain = longestPathRanks(graph, backEdges(graph));
```

<!-- entry: breaking api -->
