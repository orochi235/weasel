---
'@weasel-js/labkit': patch
---

labkit annotations gain a `point` kind: one stored point with zero-size bounds, drawn as a small unfilled ring in the mark color and dashed when stale, reachable through `hitTest`'s tolerance like any hairline mark. The ring is sized in world units for now, so it scales with the picture rather than holding a fixed screen size.
