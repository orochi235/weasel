---
'@weasel-js/text': major
---

`layoutMarkdown` is `layoutCanvasRuns`, and its options type `LayoutCanvasRunsOptions`: it wraps runs already parsed, and parses no markdown.

```ts
// before
const layout = layoutMarkdown(runs, 240, 16, measure);
// after
const layout = layoutCanvasRuns(runs, 240, 16, measure);
```

<!-- entry: breaking api -->
