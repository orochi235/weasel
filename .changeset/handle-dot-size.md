---
'@weasel-js/theme': patch
'@weasel-js/ui': patch
---

Adds tokens: `--wzl-handle-dot-size` (8px) and `--wzl-handle-dot-size-sm` (7px), the diameters of a round handle and of one that belongs to another point. `CurveEditor`'s plain anchor circle and its bezier control handles read them where each held a radius literal of the same size, and `handleSize` / `handleHalf` take the two names. The round ranks are their own tokens beside `--wzl-handle-size`, not that family restated as a diameter; that choice was made on an agent's judgment.
