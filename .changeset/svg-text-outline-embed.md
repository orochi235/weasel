---
'@weasel-js/svg': minor
---

SVG export can write text as its glyph outlines, or embed the faces it is set in, so another renderer draws it in the face the canvas does.

`serializeSvg(nodes, { text })` takes `'live'` (the default, a `<text>` as before), `'outline'` (each text node as one filled path per paint, placed as the canvas places it) or `'embed'` (live text, with an `@font-face` rule per face holding the font file as a data URL). Under `'embed'`, text set in a face whose license forbids embedding, or that has no font file behind it, is written as outlines and `onWarn` names the face. Load the outlines first with `await warmSvg(nodes, { text })`.

`svgTextOutlines(node)` is the outline lowering on its own.

<!-- entry: rank=10 api new data -->
