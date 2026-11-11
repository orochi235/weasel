---
"@weasel-js/core": patch
---

A drag's pointer that is no finite number lands nowhere. Move, resize, rotate, clone, insert, the marquee, and the lasso decline a press at such a point, and skip such a move, going on from the last frame that landed; a move, resize, rotate, or clone also skips a move that would carry a pose past the double range. A move or clone dragged to `NaN` used to commit `NaN` poses, a rotate turned toward a pointer at infinity, an insert ending on one dropped the shape, and a marquee ending on one cleared the selection.
