---
'@weasel-js/text-shaping': patch
'@weasel-js/text': patch
'@weasel-js/core': patch
---

New package `@weasel-js/text-shaping`: OpenType shaping through HarfBuzz. `await loadShaper()` loads its WebAssembly and resolves with a shaper; `registerShaper(shaper)` (from `@weasel-js/text`, re-exported by core) hands it to every text layout, and `layoutRuns` also takes one as `opts.shaper`. Text set in a face registered with `registerFontOutlines` from TrueType or OpenType bytes is then shaped: Arabic joins, Devanagari forms its conjuncts and places its vowel signs, marks sit where the face's `GPOS` puts them, and ligatures and the face's kerning come from the shaping. Text drawn from an atlas, or with no shaper registered, lays out as before.

A shaped code point draws its whole cluster from its own pen, and the cluster's other code points take no width; `PlacedGlyph.shaped` carries what it draws. `fontVariantCaps: 'small-caps'` on a shaped face with an `smcp` feature now draws the face's own small capitals instead of synthesizing them, and `ResolvedRun` gains `fontFeatures` for it. This adds API: `registerShaper`, the `TextShaper`, `ShapedGlyph` and `ShapedCluster` types, `LayoutRunsOpts.shaper`, `ResolvedRun.fontFeatures` and `PlacedGlyph.shaped`.
