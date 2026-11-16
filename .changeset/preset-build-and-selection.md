---
"@weasel-js/core": minor
---

A preset can build tools and contributions from the canvas it runs on, and build the canvas's selection.

`FeaturePreset.build(ctx)` is handed the canvas's scene, adapter, pose descriptor, `toolOptions`, and, read live,
its pickers (`ctx.pick`), selection and `selectTool` options. It returns `tools` the preset offers by id, mounted when
a preset's `tools`, `defaultTools` or a `tools` patch names them, and `contributions`, installed after the presets'
own. `FeaturePreset.selection` is a `SelectionFactory`, `(store, options) => SelectionApi`, that builds the selection
the canvas writes through; one per canvas. Neither is a hook. `SceneCanvasToolOptions` takes a package's own
`toolOptions` keys by declaration merging.

```ts
const stampPreset: FeaturePreset = {
  id: 'stamp',
  tools: ['stamp'],
  build: (ctx) => ({ tools: { stamp: createStampTool(ctx.pick) } }),
};
```

<!-- entry: rank=10 new api -->
