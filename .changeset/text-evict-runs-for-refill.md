---
'@weasel-js/text': major
---

`clearRuns` is `evictRunsForRefill`: it evicts the caches' entries for a runs array its caller is about to refill, and does not clear the array.

```ts
// before
clearRuns(placed.runs);
// after
evictRunsForRefill(placed.runs);
```

<!-- entry: breaking api -->
