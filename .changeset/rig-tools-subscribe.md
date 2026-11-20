---
'@weasel-js/rig': minor
---

The rig tools take a `subscribe` option, so their overlays repaint when a `selection` or `rig` held outside the scene changes.

`useRigTools`, `useBoneTool`, and `useWeightTool` all take it. Pass it whenever those thunks read state the scene doesn't hold: `useRigTools({ scene, selection: () => mine, subscribe: mineChanged })`.

<!-- entry: api -->
