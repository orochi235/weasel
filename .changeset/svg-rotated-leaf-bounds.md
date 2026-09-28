---
"@weasel-js/svg": patch
---

`svgNodesToKitDrafts` bounds a `<g>` container by its rotated leaves' axis-aligned boxes rather than their unrotated ones, and `unpackSvgFiles` does the same for its multi-root wrapper and fit-clamp. A container around a rotated shape used to be too small, so its selection box and resize handles missed the shape.
