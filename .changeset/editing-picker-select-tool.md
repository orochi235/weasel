---
'@weasel-js/editing': major
---

`useSelectToolWith` and `createSelectToolWith`, the select tool over a host's picker, are `usePickerSelectTool` and `createPickerSelectTool`.

Both are also renamed in `@weasel-js/editing/engine`; their arguments are unchanged.

```ts
// before
const select = useSelectToolWith(selectAdapter, { pickEvery, pickBest });
// after
const select = usePickerSelectTool(selectAdapter, { pickEvery, pickBest });
```

<!-- entry: breaking api -->
