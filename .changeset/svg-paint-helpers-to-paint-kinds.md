---
'@weasel-js/svg': major
'@weasel-js/paint-kinds': minor
---

`tilePreviewSvg`, `tilePreviewCssUrl`, `nativeSvgKind` and `nativeSvgSpace` move from `@weasel-js/svg` to `@weasel-js/paint-kinds`.

This is breaking: import them from `@weasel-js/paint-kinds`, which also exports `tileShapeXml`, one tile shape as SVG markup, which svg's `<pattern>` export and a swatch preview share.

<!-- entry: breaking api -->
