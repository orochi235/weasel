---
"@weasel-js/font": patch
"@weasel-js/text": patch
"@weasel-js/core": patch
"@weasel-js/hud": patch
---

Every text tier now places its baseline from the ascent and descent a browser
sets the face with, and centers the face in its line the way CSS does: half
the leading above the ascent. A face taller than its line box, such as Papyrus
at `lineHeight: 1.2`, gets negative leading and overflows the box, which keeps
its height. Before, a line hung its baseline one ascent below the line top
with no leading, so glyphs sat half the leading away from where CSS puts
them: high in a roomy line, low in a tight one, where a tall face overflowed
only at the bottom.

The ascent rule is `verticalMetricsFromTables` (new, additive, in
`@weasel-js/font`): `OS/2` typo metrics when the font sets
`USE_TYPO_METRICS`, otherwise `hhea`. Firefox and every Linux engine follow it;
Chromium and WebKit on macOS read `hhea` regardless, and the edit overlay's
measured correction covers the difference there. `gen-font` bakes the result
into the atlas's `faceMetrics` block as `ascent` / `descent`, the outline
parser reads the same values (and reports them as `OutlineFace.ascender`), and
the canvas tier records the browser's own, measured at a 1000px em rather than
at the 48px bake size. An atlas or custom parser that states no ascent and
descent keeps the previous placement.

Rendering changes: text in the bundled Inter at `lineHeight: 1.2` moves up by
0.005 em. Canvas-tier faces move down by half their leading: Georgia by 1.3px
and Arial by 1.7px at 40px. The committed Inter atlases are rebaked; the PNG is
byte-identical.
