---
'@weasel-js/guides': patch
---

`useGridCellHover` listens on whatever element its `ref` holds after each render, so a canvas that mounts late or remounts is tracked.

<!-- entry: fix -->
