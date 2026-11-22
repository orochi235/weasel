---
'@weasel-js/svg': patch
---

An SVG `fill`, `stroke`, or `color` written as a color function the reader cannot read (`var()`, `color-mix()`, a malformed `rgb(`) reads as `unset`, with a warning, so the shape takes its parent's paint instead of painting black.

<!-- entry: fix visual -->
