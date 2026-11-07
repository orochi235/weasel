---
'@weasel-js/svg': patch
---

`serializeSvg` draws an inner- or outer-aligned stroke on text, or on a text run, on its own side of the glyph edges, as the canvas and `writePdf` do. It used to write the stroke centered and warn. The text is written with that stroke at `stroke-width="0"`, followed by a copy stroking it at twice the width: clipped to the glyphs for an inner stroke, masked to outside them for an outer one. The text, its copies, and their clip or mask sit in one `<g>` that holds the node's rotation and opacity. `parseSvg` drops the copies and reads the stroke's width and alignment back.
