---
'@weasel-js/symmetry': major
---

`handleDragAction` is `createSymmetryHandleAction`, spelled like the other action factories.

```ts
// before
useAction(handleDragAction(ctrl));
// after
useAction(createSymmetryHandleAction(ctrl));
```

<!-- entry: breaking api -->
