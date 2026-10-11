---
'@weasel-js/core': patch
---

A click counted as landing on a path anchor within 10 world units of it, whatever the zoom: at 8× a click 80 px away selected or cut the anchor, and at 0.1× the target was 1 px wide. `selectAnchor` and `cutPathAtAnchor` now measure 10 screen pixels through the view.
