---
'@weasel-js/ui-input': major
---

`selection` is `createSelectionModel`, and `selectionOfEach` is `createEachSelectionModel`.

The selection model factories are named for what they build.

```ts
// before
const model = selection({ value, onChange }, values);
// after
const model = createSelectionModel({ value, onChange }, values);
```

<!-- entry: breaking api -->
