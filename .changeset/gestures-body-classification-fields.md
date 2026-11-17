---
'@weasel-js/gestures': major
---

`BodyClassification`, what a `classifyTarget` thunk returns, names its fields `bodyTarget` and `bodyKind`, as the input events it fills already do.

Its `doubleClick` entry takes the same two names.

```ts
// before
classifyTarget: (world) => ({ body: 'unselected-body', kind: 'text' })
// after
classifyTarget: (world) => ({ bodyTarget: 'unselected-body', bodyKind: 'text' })
```

<!-- entry: breaking api -->
