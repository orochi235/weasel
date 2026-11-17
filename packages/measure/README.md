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
const ambient = useMemo(() => [createMeasurementsContribution(scene, measurements)], [scene, measurements]);

<SceneCanvas scene={scene} tools={[tools.measure]} ambient={ambient} snap={{ sources: [measureEndSource()] }} />
```

`notes` is a layer the scene declares with `annotation: true`. The contribution
registers the painter that draws measurements in the scene's own node shapes
(`nodeShapesOf(scene)`), the layer that shows the picked one, and the
commands, which `MEASURE_ACTION_IDS` names. `MEASURE_TOOLS` names the tool for
a palette. A render with no canvas registers `MEASURE_PAINTER` itself.

## The readout

`<MeasureReadout>` is a chip pinned to the bottom of its nearest positioned
ancestor. It shows the measurement a drag is drawing, else the picked one,
else the newest: its distance, offsets and angle, in the units of the frame
its ends landed in. Its Move by, Rotate by, Delete and Clear all buttons run
the contribution's commands from the actions registry, and one that cannot run
says why in its tooltip. It reads the canvas's registries, so it and the
canvas share one `<DepRegistryProvider>` and `<ActionsProvider>`. It draws with
`@weasel-js/ui`'s components, so load both stylesheets.

```tsx
import '@weasel-js/ui/style.css';
import '@weasel-js/measure/style.css';

<DepRegistryProvider>
  <ActionsProvider>
    <div className="stage">
      <SceneCanvas scene={scene} tools={[tools.measure]} ambient={ambient} />
      <MeasureReadout scene={scene} measurements={measurements} />
    </div>
  </ActionsProvider>
</DepRegistryProvider>
```
