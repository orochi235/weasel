# @weasel-js/measure

Measuring for a weasel canvas. A measurement is a scene node on an annotation
layer, so it saves and undoes with the document and stays out of export and
content picking. The measure tool draws one per drag; under every tool a click
picks one, a drag moves it or one of its ends, and Move by and Rotate by carry
the selection by the picked measurement.

Part of [weasel](https://github.com/orochi235/weasel), a domain-agnostic
scene-graph engine for React. See the
[API reference](https://orochi235.github.io/weasel/#pkg/measure).

```sh
npm install @weasel-js/measure
```

## On a canvas

```tsx
const [measurements] = useState(() => createMeasurements({ layer: 'notes' }));
const tools = useMeasureTools({ measurements });
const ambient = useMemo(() => [measurementsContribution(scene, measurements)], [scene, measurements]);

<SceneCanvas scene={scene} tools={[tools.measure]} ambient={ambient} snap={{ sources: [measureEndSource()] }} />
```

`notes` is a layer the scene declares with `annotation: true`. The contribution
registers the painter that draws measurements in the scene's own node shapes
(`nodeShapesOf(scene)`), the layer that shows the picked one, and the
commands, which `MEASURE_ACTION_IDS` names and `<MeasureReadout>` in
`@weasel-js/ui` binds buttons to. `MEASURE_TOOLS` names the tool for a palette.
A render with no canvas registers `MEASURE_PAINTER` itself.
