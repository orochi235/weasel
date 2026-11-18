---
'@weasel-js/labkit': major
---

`isLeafVisible`, `isLeafEnabled` and `isLeafActive` are renamed `isRowVisible`, `isRowEnabled` and `isRowActive`. They judge any row at a path, groups included.

```ts
// before
isLeafVisible(resolved, 'grid', config);
// after
isRowVisible(resolved, 'grid', config);
```

<!-- entry: breaking api -->
