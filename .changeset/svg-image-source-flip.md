---
'@weasel-js/svg': patch
---

An `<image>`'s source rect and flip now survive SVG. `SvgImageNode` gains `source` (the part of the bitmap to draw, as fractions of its width and height) and `flipX` / `flipY`. With any of them set, the serializer writes a `<g data-weasel-image>` around a nested `<svg>` viewport at the box, whose `viewBox` is the source window over a unit-square `<image>`, with the flip as a mirror about that window's center. That is plain SVG 1.1, so every viewer crops and mirrors it the way weasel draws it, and `parseSvg` reads the group back as one image node. An image with neither still writes a plain `<image>`. Additive.
