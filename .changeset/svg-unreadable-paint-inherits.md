---
'@weasel-js/svg': patch
---

An SVG fill or stroke the reader cannot read takes the parent's paint instead of painting black. A `fill`, `stroke`, or `color` written as an unknown function (`var()`, `color-mix()`, a malformed `rgb(`) reads as `unset`, with a warning.

<!-- entry: fix visual -->
