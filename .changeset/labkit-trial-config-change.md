---
'@weasel-js/labkit': minor
---

`useTrialConfigChange` writes an instrument's data inside a setting's undo step: a style panel and the strokes it styles undo together.

The handler runs during the write, after the value lands and before anything renders, with the config and the one before it. What it writes onto the history handed over with `useTrialHistory` joins the settings entry, and a run of writes to one setting, a slider's drag, stays one step. `<TrialSceneCanvas>`'s history does this through the new optional `TrialHistorySource.batch`; a history of your own without it records the handler's writes as a step of their own. Undo, redo, Reset and a loaded record do not run it.

```tsx
useTrialConfigChange<Config>((config, prev) => {
  if (config.width === prev.width) return;
  scene.batch('Stroke width', () => {
    for (const id of scene.getSelection()) scene.update(id, { data: { ...scene.get(id)?.data, width: config.width } });
  });
});
```

<!-- entry: rank=5 new api -->
