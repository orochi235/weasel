---
'@weasel-js/font': patch
'@weasel-js/text': patch
'@weasel-js/renderer': patch
---

Fixes: emoji painted as flat silhouettes in the text's fill color, and an emoji of several code points painted as its parts (`👍🏽` a thumb and a swatch, `🇨🇦` two letters, a joined family three people). A grapheme cluster with emoji presentation is now one glyph, rasterized whole through a 2D canvas, kept in its own colors on RGBA pages of the dynamic atlas, and painted untinted. It takes only the opacity of the text's fill, and shares a draw with the text around it.

Behavior change: this applies to every run, whatever tier serves its text, unless the fallback policy is `'none'` and the run is not on the canvas tier. A cluster's advance is now the platform's for the whole cluster, so text holding emoji measures and wraps differently than before. In `LaidOutLineBox.cells`, an emoji's closing code point holds the whole advance and `drawsInk`; the code points before it have no width and `drawsInk: false`.

Adds API, `@weasel-js/font`: `resolveColorCluster(resolved, family, weight, style, cluster)`, `DynamicFace.requestCluster(text)`, `BmFontChar.color`, `syncColorPageTexture(sink, page)`, and `colorPageTextureId(page)`. `@weasel-js/text`: `LaidOutGroup.source` gains `'color'`.

Breaking for an implementer of `GlyphTextureSink`: the interface gains `uploadRGBA` and `subImageRGBA`. Breaking for a reader of `LaidOutGroup.source` that treated everything but `'outline'` as a distance-field atlas: a `'color'` group's quads sample a color page.
