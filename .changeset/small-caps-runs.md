---
"@weasel-js/text": patch
"@weasel-js/core": patch
"@weasel-js/font": patch
"@weasel-js/svg": patch
"@weasel-js/hud": patch
---

Text can be set in small caps. `StyledRun` and `TextStyle` take
`fontVariantCaps: 'normal' | 'small-caps'`. A run overrides the node, and
`'normal'` on a run turns off small caps it would inherit. Lowercase letters
are drawn as capitals at a smaller size. The run's `text` is not rewritten, so
carets, selections and hit tests address what was typed. The small-caps
reading is applied after `textTransform`, as CSS does it.

This is a synthesis, not the font's `smcp` feature. The small size is the
face's x-height over its cap height (`smallCapsScaleFor`). A face that states
neither height gets `SMALL_CAPS_SCALE`, 0.7, which is the factor Chromium and
WebKit use. `FaceMetrics` gains `xHeight` and `capHeight`, read from `OS/2`
on both tiers. The bundled Inter atlas carries them now.

`ResolvedRun` gains an optional `sizeMap`, which holds the size each unit of
its text is drawn at. `fontSize` still sets the line height and the rules, so
a small-caps word keeps its line and gets one underline. The layout cache keys
on the size map. The outline-tier size gate reads the run's size, so one word
is never split across tiers.

The edit overlay sets the lowercase letters of a small-caps run in
`<span data-small-caps>` pieces. It sizes them at the canvas scale, because a
browser's own synthesis uses a fixed factor. It re-splits the pieces as you
type. A plain-text edit now commits the overlay's DOM text instead of
`innerText`. `innerText` applies `text-transform`, so a node shown in capitals
committed the capitals as its text. `@weasel-js/svg` writes
`font-variant="small-caps"`, and `normal` on a tspan, and reads either back.

All of this is additive.
