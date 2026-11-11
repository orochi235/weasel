---
'@weasel-js/ui': patch
---

Paint swatches in `PaintField`, `PaintInput` and `FillStrokeSwatch` show a paint at its `opacity`. `paintPreviewCss` applies it to solid, gradient and mesh paints; an image pattern's preview still ignores it, since a CSS `background` value cannot fade.

<!-- entry: fix visual -->
