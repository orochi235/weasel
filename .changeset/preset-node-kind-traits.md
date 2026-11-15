---
'@weasel-js/core': minor
---

A `FeaturePreset` can carry the routing, insert factories, painters, and properties of a node kind; `nodeKindPreset` builds one.

Each trait goes to its owner while the preset is on: `routing` classifies ahead of the canvas's `routing` (or `inferredNodeRouting`), `insertNodeFactories` builds the inserts its kinds name, `shapes` register as `registerNodeShape` would for as long as the canvas runs the preset, and `properties` is what a `SelectionPanel` given the same presets edits. A name the consumer's own prop gives keeps the consumer's; two presets giving one name different values throw. `nodeTraitsOf(features, base)` returns the merged traits.

```tsx
const gemFeature = nodeKindPreset({
  id: 'app:gem', kind: 'gem', matches: isGem,
  shape: gemPainter, insert: gemFactory, properties: { schema: gemSchema }, tools: [gemTool],
});
<SceneCanvas scene={scene} features={[drawPreset, gemFeature]} />;
```

<!-- entry: rank=10 new api -->
