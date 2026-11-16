---
'@weasel-js/core': minor
---

A preset can mount React components inside the canvas and add content handlers to its ingestion.

`FeaturePreset.components` are rendered inside the canvas while the preset is on, after its own deps and before its children, each given `PresetComponentProps` (the scene, the canvas element's ref, and whether it paints into a host's element): for a part that needs React and the mounted canvas, such as an editing overlay. `FeaturePreset.contentHandlers` are tried after the canvas's own `ingestion.handlers` and the kit's.

<!-- entry: rank=5 new api -->
