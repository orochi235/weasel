---
'@weasel-js/geom': patch
'@weasel-js/font': patch
'@weasel-js/renderer': patch
'@weasel-js/text': patch
---

`textToPath` and `textToPathsByPaint` outline synthetic-bold text instead of throwing. A glyph whose weight is faked from a lighter face grows by the distance the renderer's field shift moves its edge (`SYNTH_BOLD_AMOUNT` of the field's span per texel of the atlas, 0.01 em a side on Inter's), with mitered corners and its curves kept. The `'synthetic-bold'` `TextOutlinesFailure` reason is removed, which breaks code that names it.

New in `@weasel-js/geom`: `growRegion(path, distance, { join, miterLimit, tolerance })`, a filled region grown outward without a boolean. Each contour is offset, curves stay curves, and the grown contours overlap where they meet, filling once under `'nonzero'`. New in `@weasel-js/font`: `SYNTH_BOLD_AMOUNT` (moved from the renderer) and `syntheticBoldGrowth(source, family, weight, style)`, the growth in em for the atlas serving a face.
