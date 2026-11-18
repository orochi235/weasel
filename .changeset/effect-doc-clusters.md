---
'@weasel-js/diagram': major
---

An effect pipeline names its boxes `clusters`, of type `EffectCluster`, and an effect doc keeps their sizes in `clusterBoxes`.

They were `groups`, `EffectGroup` and `groupBoxes`. A doc saved under the old names still loads through `readEffectDoc`, which reads them as the new ones; code building a pipeline or a doc writes the new names.

```ts
// before
const pipeline: EffectPipeline = { stages, wires, groups: [{ id: 'g', members: ['a', 'b'] }] };
const doc: EffectDoc = { pipeline, places, groupBoxes: { g: box } };
// after
const pipeline: EffectPipeline = { stages, wires, clusters: [{ id: 'g', members: ['a', 'b'] }] };
const doc: EffectDoc = { pipeline, places, clusterBoxes: { g: box } };
```

<!-- entry: breaking api data -->
