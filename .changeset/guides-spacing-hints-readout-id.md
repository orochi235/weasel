---
'@weasel-js/guides': patch
---

Two `createSpacingHintsPreset`s given ids share a canvas: each names its distance readout `<id>.readout`, so their readouts no longer collide.

<!-- entry: fix -->
