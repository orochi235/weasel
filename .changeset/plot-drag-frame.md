---
'@weasel-js/plot': minor
---

Plot handle drags take a `toPlot` and `fromPlot` hook, so a 3D host can cast the pointer onto the plane a chart lies on.

`createPlotDragAction`, `createPlotEditingContribution`, `createPlotHandleLayer(scene, frame)` and `plotHandles(scene, frame)` accept a `PlotFrame`:
`toPlot(world, rootId)` reads a world point into the plot's coordinates, and `fromPlot(plot, rootId)` places a handle back in the world. Either one
left out is the translation by the root's corner, as before. `createPlotFrame(scene, frame)` fills in the defaults.

```ts
createPlotEditingContribution({
  scene,
  toPlot: (world, rootId) => castOntoChartPlane(world, rootId),
  fromPlot: (plot, rootId) => projectFromChartPlane(plot, rootId),
});
```

<!-- entry: new api -->
