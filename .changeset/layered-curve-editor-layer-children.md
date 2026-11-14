---
'@weasel-js/ui': major
---

`LayeredCurveEditor` takes its layers as children: `<FunctionLayer>`, `<KeyframeLayer>`, and `<CustomLayer>` for any `CurveLayer`.

The `layers` prop, `onLayerChange`, `onLayerCommit`, and the `LayerBinding` type are removed. Each layer takes its own `state`, `onChange(next)`, and `onCommit(next, prev)`, and `FunctionLayer` and `KeyframeLayer` take their factory's configuration as props. Children draw in order and plain SVG can sit among them; the topmost layer claiming a press still takes it. A `CurveLayer`'s `id` now only names its group (`data-layer-id`), so two layers may share one.

```tsx
// before
<LayeredCurveEditor layers={[{ layer: keysLayer, state }]} onLayerChange={(_id, next) => setState(next as KeyframeLayerState)} width={480} height={220} />
// after
<LayeredCurveEditor width={480} height={220}>
  <KeyframeLayer label="Opacity" state={state} onChange={setState} />
</LayeredCurveEditor>
```

<!-- entry: rank=5 breaking api -->
