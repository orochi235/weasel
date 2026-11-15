---
'@weasel-js/core': patch
---

A `{ px }`-sized text node with `clip: 'outline'` clips its children to the lines it draws at the view's zoom.

That holds on screen, in gesture previews, and for picking, marquee, and lasso. `clipOutline` takes the view scale as an optional fifth argument.

<!-- entry: fix -->
