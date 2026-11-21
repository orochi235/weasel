---
'@weasel-js/svg': patch
---

SVG import draws a document's own `<marker>` even when its id is a kit marker's key, such as `arrow`.

A document this package wrote still reads its markers back as kit markers: SVG export now declares the `wzl` namespace whenever it writes a marker.

<!-- entry: fix data -->
