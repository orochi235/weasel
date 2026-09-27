---
"@weasel-js/core": patch
---

The lasso tool selects by the polygon you draw rather than its bounding box. `SceneCanvas`'s lasso used to pick every shape its polygon's bounding box touched, in every hit mode, and `toolOptions.lasso.mode` never reached it. Now `intersect` (the default) takes shapes whose outline meets the polygon, `enclosed` takes shapes wholly inside it, and `centers` takes shapes whose center is inside it. Each test uses the shape's drawn outline with its rotation applied.

A marquee also tests a rotated shape that has no painter by its rotated rect instead of that rect's bounding box.
