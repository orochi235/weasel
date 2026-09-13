---
"@weasel-js/core": patch
---

A layer one view hides is now gone from that view for input too, not only for
paint.

- `<SceneCanvas>` documents `layerVisibility` / `layerOrder` as its own props.
  They already reached the painter; now a click, a marquee, a lasso, Cmd+A and
  hover in that canvas pass over a scene layer it hides (keyed
  `scene:<layerId>`). Another view of the same scene still paints and takes it.
  The scene's own `LayerRecord.visible` still applies underneath and cannot be
  overridden.
- `<CanvasView>` (and `SceneCanvasApi.addView`) take the same two props,
  applied after `layers` narrows the stack, for its paint and its picking. It
  now also honors a layer's `defaultVisible`, as the surface does.
- `<SceneViewCanvas>`, `<MinimapCanvas>`, `renderSceneToCanvas` and
  `buildSceneViewCommands` take `layerVisibility` / `layerOrder` keyed the same
  way, so the main canvas's map can be passed straight to its minimap.
- `useSelectTool` takes `alphaOf` and `layerIsPainted`, so a consumer with an
  adapter and no `Scene` can make faded or unpainted nodes unclickable.
- `ViewApi` gains an optional `layerIsPainted`; `selectAll`, `areaSelect` and
  `lassoSelect` now require the `view` dep and pass it to
  `AreaSelectDep.hitTestArea` / `LassoSelectDep.hitTestArea` / `hitTestLasso`
  as a new optional last argument. A marquee or lasso on a canvas with
  `alphaFor` also skips nodes painted at alpha 0, as a click already did.
