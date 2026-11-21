---
'@weasel-js/svg': patch
---

SVG import anchors a `<marker>` with no `viewBox` at its `refX` and `refY` keywords. `center`, `right`, and `bottom` resolve against the marker's own width and height.

<!-- entry: fix visual -->
