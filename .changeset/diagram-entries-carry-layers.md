---
'@weasel-js/diagram': major
---

Each diagram editing helper returns one entry for `ambient`, with its layer inside, instead of a layer and a contribution.

The helpers are `diagramPorts`, `diagramWaypoints`, `diagramEdgeEnds`, `diagramLabelDrag`, `diagramContainers`, `diagramSequence` and `diagramOffPage`. There is no layer to register by hand any more, and `createDiagramContribution` is gone: `diagramPorts` is the connect gesture. Layers are hit in `ambient` order, the last first.

```tsx
// Before
const { layer, contribution } = useMemo(() => diagramPorts({ participants }), [participants]);
useEffect(() => canvasRef.current?.registerLayer(layer), [layer]);
<SceneCanvas ref={canvasRef} ambient={[contribution]} />

// After
const ports = useMemo(() => diagramPorts({ participants }), [participants]);
<SceneCanvas ambient={[ports]} />
```

<!-- entry: rank=10 breaking api -->
