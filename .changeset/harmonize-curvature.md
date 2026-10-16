---
'@weasel-js/geom': patch
'@weasel-js/core': patch
---

The `harmonizeAnchors` action makes smooth anchors curvature-continuous by changing only their handle lengths, along the directions the handles already have, keeping the product of each anchor's two lengths: the selected anchors, or every smooth anchor of the path while none is selected. Corners, open ends, and anchors the curve inflects through are left alone. It is labeled "Harmonize curvature", has no key of its own, and is in the standard actions, the `paths` preset, and the `anchors` group beside `retractHandles` and `makeHandlesSymmetric`, with the icon `HarmonizeIcon`.

`@weasel-js/geom` adds the edit underneath: `harmonizeAnchors(set, flatIndexes?)`.
