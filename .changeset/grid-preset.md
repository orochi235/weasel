---
'@weasel-js/core': patch
'@weasel-js/guides': patch
---

A `FeaturePreset` can carry `layers`: pre-built layers by slot, as `<SceneCanvas layers>` takes them. A slot the canvas's own `layers` names, `null` included, keeps the consumer's entry. This adds API.

`@weasel-js/guides` adds `createGridPreset({ spacing, … })`, which draws a grid in the grid slot and snaps gestures to it, so `features={['draw', createGridPreset({ spacing: 20 })]}` replaces building the grid layer and the grid snap source and passing each to its own prop. It takes every `createGridLayer` option, and `snap: false` or `snap: { origin }`.
