---
'@weasel-js/core': major
---

`MoveOptions.moveLabel` is `label`, the name the run lifecycle gives the history label.

```ts
// before
<SceneCanvas selectTool={{ move: { moveLabel: 'Drag' } }} />
// after
<SceneCanvas selectTool={{ move: { label: 'Drag' } }} />
```

<!-- entry: breaking api -->
