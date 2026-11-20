---
'@weasel-js/labkit': patch
---

Undo after a layer is shown, hidden or reordered puts the layers back, when the instrument snapshots on `layers.toggle` or `layers.reorder`.

A history the instrument mounted with `useTrialHistory` records the step too.

<!-- entry: fix -->
