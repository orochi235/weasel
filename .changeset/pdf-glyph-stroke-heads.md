---
'@weasel-js/pdf': patch
---

`writePdf` draws no marker heads on a text stroke it writes as glyph outlines (an aligned stroke, a gradient one, or faked bold), as the canvas draws none on text. A `markerMid` used to put a head on every vertex of every glyph.
