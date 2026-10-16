---
'@weasel-js/geom': patch
'@weasel-js/core': patch
---

Path edit gains soft selection and handle snapping, both on the `editAnchors` action and set through `<SceneCanvas tune>` (`EditAnchorsParams`).

- **Soft selection** (`soft: { radiusPx, falloff }`, off unless given). Dragging anchors also moves the anchors near them, each by a weight falling from 1 to 0 over the radius, which is measured along the path in screen pixels. The falloff is `'smooth'`, `'linear'` or `'sharp'`. The reach is drawn as a band while the drag lasts, and the wheel scrubs the radius mid-drag, reporting each new value to `onSoftRadius`. Under a `pathSymmetry` dep a soft drag moves no symmetric images.
- **Handle snapping** (`handleSnap: { stepDeg, toleranceDeg, opposite }`, off unless given). A dragged control handle's angle snaps to multiples of the step (45° by default) and to the line through the anchor's other handle, within the tolerance, keeping its length. The line it snapped to is drawn. A held angle lock wins over the snap; a held length lock keeps the length while the angle snaps.

`@weasel-js/geom` adds the geometry: `measureAnchorPath`, `softSelectionWeights`, `softSelectionBand` and `softFalloff` for soft selection, and `snapHandleAngle` for handles.
