---
'@weasel-js/editing': major
---

Editing's contribution factories are spelled `create…Contribution`.

`selectionMoveContribution`, `selectionTransformContribution`, `selectionResizeContribution`, `selectionRotateContribution` and `areaSelectContribution` are renamed; their arguments are unchanged.

```ts
// before
const ambient = [selectionMoveContribution(), areaSelectContribution()];
// after
const ambient = [createSelectionMoveContribution(), createAreaSelectContribution()];
```

<!-- entry: breaking api -->
