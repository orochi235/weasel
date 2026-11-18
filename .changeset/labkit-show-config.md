---
'@weasel-js/labkit': minor
---

`ctx.showConfig` lets a settings panel follow a canvas edit without an undo step of its own: a drag and the panel it moves undo together.

Write a setting from a scene subscriber with `ctx.showConfig(path, value)` where the setting shows what the scene holds — the selected stroke's style, a group's center. It records no undo entry and runs no `onConfigChange` or `useTrialConfigChange` handler, so the canvas edit's own entry is the one step, and undoing it puts the scene back for the subscriber to show again. `setConfig` stays the write for a change the user makes in the panel.

```tsx
const { showConfig } = ctx;
useLayoutEffect(
  () => scene.subscribe(() => showConfig('size', scene.get(id)?.data?.size)),
  [scene, showConfig],
);
```

<!-- entry: rank=5 new api -->
