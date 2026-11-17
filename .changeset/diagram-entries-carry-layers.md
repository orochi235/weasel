---
'@weasel-js/diagram': major
---

Each diagram editing helper returns one entry for `ambient`, with its layer inside, instead of a layer and a contribution.

The helpers are `createDiagramPortsContribution`, `createDiagramWaypointsContribution`, `createDiagramEdgeEndsContribution`, `diagramLabelDrag`, `createDiagramContainersContribution`, `createDiagramSequenceContribution` and `createDiagramOffPageContribution`. There is no layer to register by hand any more, and `createDiagramContribution` is gone: `createDiagramPortsContribution` is the connect gesture. Layers are hit in `ambient` order, the last first.

```tsx
// Before
const { layer, contribution } = useMemo(() => createDiagramPortsContribution({ participants }), [participants]);
useEffect(() => canvasRef.current?.registerLayer(layer), [layer]);
<SceneCanvas ref={canvasRef} ambient={[contribution]} />

// After
const ports = useMemo(() => createDiagramPortsContribution({ participants }), [participants]);
<SceneCanvas ambient={[ports]} />
```

<!-- entry: rank=10 breaking api -->
