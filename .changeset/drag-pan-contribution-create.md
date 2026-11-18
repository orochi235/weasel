---
'@weasel-js/core': major
---

`dragPanContribution` and `middleDragPanContribution` are `createDragPanContribution` and `createMiddleDragPanContribution`.

```ts
// before
<SceneCanvas ambient={[dragPanContribution()]} />
// after
<SceneCanvas ambient={[createDragPanContribution()]} />
```

<!-- entry: breaking api -->
