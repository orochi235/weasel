---
'@weasel-js/core': patch
---

The debug overlay's fps and frame readout shows the current rate as soon as repainting resumes after an idle spell. It averages over the last second of paints, so a hidden tab coming back reads right too.

<!-- entry: fix -->
