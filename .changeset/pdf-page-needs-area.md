---
"@weasel-js/pdf": patch
---

`writePdf` refuses a page whose width or height is not finite or would be written as 0, naming the page
(`pdf: page 2 is 0 by 0.001; …`). A page of no area was written with an empty media box, a negative side put the
box beside the drawing, and a non-finite side threw the writer's internal number error.
