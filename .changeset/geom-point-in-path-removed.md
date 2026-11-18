---
'@weasel-js/geom': major
'@weasel-js/core': major
---

`pointInPath` is removed; `pathContainsPoint`, which it was a second name for, answers the same question.

```ts
// before
const inside = pointInPath(path, x, y);
// after
const inside = pathContainsPoint(path, x, y);
```

<!-- entry: breaking api -->
