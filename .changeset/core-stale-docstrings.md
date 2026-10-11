---
'@weasel-js/core': patch
---

Corrected docstrings that described behavior the code no longer has: `usePenTool` discards an unfinished path on a tool switch (the docs said it commits), `useHandTool` is a single binding to `viewport.dragPan`, `createRotationAffordance` paints a visible band and shows the `rotate` cursor by default, `createCornerResizeAffordance` regions bind only scratch, and `composeAffordanceLayer` picks the nearest region within an affordance.
