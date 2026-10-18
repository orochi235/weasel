---
'@weasel-js/font': patch
'@weasel-js/text': patch
'@weasel-js/renderer': patch
---

An emoji drawn larger than its 48px bake no longer blurs. The renderer asks the dynamic atlas for the cluster baked again at the power of two above its on-screen size, up to 384px, and samples that over the same box once it lands; until then it draws from the sharpest bake it has. These bakes sit on pages of their own (`sharpColorPageTextureId`, `syncSharpColorPageTexture`), which empty alone when they fill, so the base bakes and the field pages are untouched. `sharperColorGlyph` is the lookup, `rasterizeColor` takes the size to draw at, and a color group's `LaidOutQuad` carries its glyph record as `colorGlyph`.
