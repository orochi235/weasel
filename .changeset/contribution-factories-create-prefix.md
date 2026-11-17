---
'@weasel-js/diagram': major
'@weasel-js/routing': major
'@weasel-js/measure': major
'@weasel-js/core': major
---

The contribution factories that were spelled bare are `create…Contribution`, as the kit's other factories are; their arguments are unchanged.

diagram: `diagramPorts`, `diagramWaypoints`, `diagramEdgeEnds`, `diagramOffPage`, `diagramContainers` and `diagramSequence` are `createDiagramPortsContribution`, `createDiagramWaypointsContribution`, `createDiagramEdgeEndsContribution`, `createDiagramOffPageContribution`, `createDiagramContainersContribution` and `createDiagramSequenceContribution`; `reorderContribution` and `itemDropContribution` are `createReorderContribution` and `createItemDropContribution`. routing's `keymapContribution` (re-exported by core) is `createKeymapContribution`, and measure's `measurementsContribution` is `createMeasurementsContribution`.

```ts
// before
const ambient = [diagramPorts(), measurementsContribution(scene, measurements)];
// after
const ambient = [createDiagramPortsContribution(), createMeasurementsContribution(scene, measurements)];
```

<!-- entry: breaking api -->
