---
"@weasel-js/font": patch
"@weasel-js/core": patch
"@weasel-js/hud": patch
---

The text edit overlay now sets its glyphs in the face the canvas draws. A family
the canvas draws from a baked atlas or from outlines — `sans-serif` registered
to Inter, say — used to reach the overlay as a bare CSS name, which the browser
resolved to its own face (Helvetica on macOS), so "Hxgd" at 72px ended 12px
short of the canvas. New `cssFontFamily(family, variant)` answers the CSS
`font-family` for whatever the canvas draws: a private `FontFace` built from the
family's `registerFontOutlines` file, with the family name as fallback. A family
drawn through the browser (`registerCanvasFont`) comes back unchanged. An atlas
with no font file cannot give the DOM its face, and says so once in the console;
register the file it was baked from with `registerFontOutlines`.
`OutlineFontOptions.cssSrc` names the `@font-face` source where the bytes won't
do, and `enableLocalFontOutlines` sets it to `local(<PostScript name>)`.

The bundled Inter atlas carries the font's own advances and kerning. It used to
lay out on whole-pixel advances at its 32px bake size with no kerning at all, so
"Hxgd" at 72px set 182.25px wide against the 179.44px every browser gives the
same face, and "AVATAR" 22px wide of it. `gen:font` now writes advances at full
precision and kerning pairs read from the font's GPOS table, and the atlas is
rebaked from `inter.ttf`. Text set in it changes width slightly.

Outline faces kern like a browser too. opentype.js skips GPOS extension
lookups, which is where Inter keeps nearly all its kerning; the outline tier now
reads pair kerning from GPOS itself.
