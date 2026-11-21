---
'@weasel-js/svg': patch
---

SVG import reads a minified `viewBox` or `rotate` list whose numbers abut, such as `viewBox="0-10 100 100"`.

A `viewBox` with a unit or other trailing text in it is dropped, as browsers drop it.

<!-- entry: fix data -->
