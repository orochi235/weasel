---
'@weasel-js/diagram': major
---

diagram's layer factories are named `create…Layer`, like core's.

`portLayer`, `waypointLayer`, `edgeEndLayer`, `labelDragLayer` and `laneLayer` are renamed `createPortLayer`, `createWaypointLayer`, `createEdgeEndLayer`, `createLabelDragLayer` and `createLaneLayer`; their arguments are unchanged.

```ts
// before
api.registerLayer(portLayer(participants));
// after
api.registerLayer(createPortLayer(participants));
```

<!-- entry: breaking api -->
