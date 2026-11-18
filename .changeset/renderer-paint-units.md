---
'@weasel-js/renderer': major
'@weasel-js/core': major
---

`fillInPoseFrame` and `fillToBoundsFrame` are renamed `paintToLocalUnits` and `paintToBoundsUnits`.

A registered paint kind's `inPoseFrame` and `toBoundsFrame` hooks follow, as `toLocalUnits` and `toBoundsUnits`. They convert any paint's units, strokes included, and apply no pose frame.

```ts
// before
const local = fillInPoseFrame(paint, box);
registerPaintKind({ kind: 'wash', inPoseFrame, toBoundsFrame, /* … */ });
// after
const local = paintToLocalUnits(paint, box);
registerPaintKind({ kind: 'wash', toLocalUnits, toBoundsUnits, /* … */ });
```

<!-- entry: breaking api -->
