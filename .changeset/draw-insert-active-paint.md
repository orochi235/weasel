---
---

`apps/draw` only, no package changes: a newly drawn shape takes the swatches' active fill and stroke, where it took the kit's next palette color. A new stroke is 2 wide, a paint of none stays none, and a line or a pencil trail takes the stroke and no fill. Draw feeds `<SceneCanvas insertPaint>` from its color context.
