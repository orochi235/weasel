---
'@weasel-js/text': major
---

`dropRuns` is `evictRuns`: it evicts the layout caches' entries for a runs array and leaves the runs alone.

```ts
// before
dropRuns(placed.runs);
// after
evictRuns(placed.runs);
```

<!-- entry: breaking api -->
