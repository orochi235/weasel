---
'@weasel-js/geom': patch
'@weasel-js/core': patch
'@weasel-js/path-tools': patch
---

Path edit gains soft selection and handle snapping, each a preset in `@weasel-js/path-tools` that nothing turns on by default, `pathTools` included.

- **Soft selection** (`createSoftSelectionPreset(() => ({ radiusPx, falloff, onRadius }))`, its options read as each anchor drag starts; null leaves the drag hard). Dragging anchors also moves the anchors near them, each by a weight falling from 1 to 0 over the radius, which is measured along the path in screen pixels. The falloff is `'smooth'`, `'linear'` or `'sharp'`. The reach is drawn as a band while the drag lasts, and the wheel scrubs the radius mid-drag, reporting each new value to `onRadius`. Under a `pathSymmetry` dep a soft drag moves no symmetric images.
- **Handle snapping** (`handleSnapPreset`, or `createHandleSnapPreset({ stepDeg, reachDeg, opposite })`, or a thunk of them read on every move). A dragged control handle's angle snaps to multiples of the step (45° by default) and to the line through the anchor's other handle, within the reach (6° by default), keeping its length. The line it snapped to is drawn. A held angle lock wins over the snap; a held length lock keeps the length while the angle snaps.

Both reach the drag through a new member of core's `PathEditExtension`: `drag(start)`, asked as an anchor or handle drag starts, returns the extension's share of it (`PathEditDrag`) — anchors that follow an anchor drag and the share of its delta each moves by (`weights`), where a dragged handle goes after the locks (`handle`), a claim on the wheel mid-drag (`wheel`), and overlays drawn while the drag lasts (`overlays`). `PathEditDragStart` and `PathEditHandleMove` describe what it reads.

`@weasel-js/geom` adds the geometry: `measureAnchorPath`, `softSelectionWeights`, `softSelectionBand` and `softFalloff` for soft selection.
