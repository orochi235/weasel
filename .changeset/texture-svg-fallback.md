---
'@weasel-js/paint-kinds': patch
'@weasel-js/svg': patch
---

A texture fill exported to SVG carries a `none` fallback after its reference, which points at nothing.

`nativeSvgKind('texture')` now answers `false`.

<!-- entry: fix data -->
