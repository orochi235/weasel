---
'@weasel-js/geom': patch
---

`schneiderFit` joins its cubics smoothly, so a pencil stroke fitted with more than one curve has no corner at each joint, and a repeated first or last sample no longer pins its handle onto its anchor.

<!-- entry: fix visual -->
