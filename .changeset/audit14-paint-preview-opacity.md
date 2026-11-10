---
'@weasel-js/ui': patch
---

`paintPreviewCss` draws a paint at its `opacity`, so a half-transparent fill's swatch in `PaintField`, `PaintInput` and `FillStrokeSwatch` reads half transparent. It drew every solid, gradient and mesh preview fully opaque. An image pattern's preview still ignores `opacity`, which a CSS `background` value cannot fade.
