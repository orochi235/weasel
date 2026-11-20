---
'@weasel-js/svg': patch
---

`parseSvg` paints a `currentColor` fallback after an unresolved `url()` paint in the `color` in effect, rather than black.

<!-- entry: fix visual -->
