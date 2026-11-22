---
'@weasel-js/svg': patch
---

`parseSvg` answers `@media` and `@container` queries at the size an `em`-sized root `<svg>` has, and resolves a percentage on the side a root sizes when it leaves the other out.

<!-- entry: fix data -->
