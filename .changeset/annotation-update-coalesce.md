---
'@weasel-js/labkit': minor
---

`AnnotationsApi.update` takes a `coalesceKey`, so several updates in a row are one undo step.

```ts
marks.update(id, { width: 6 }, { coalesceKey: 'restyle:1' });
```

<!-- entry: api -->
