# @weasel-js/text-shaping

## 1.18.2

### Patch Changes

- @weasel-js/bidi@1.18.2

## 1.18.1

### Patch Changes

- c9fb4d6: Fixes to glyph outlines, local font weights, and loads that fail once.
  
  - A glyph outline whose parser leaves a contour open before a relative `m` keeps its contours in place. Closing that contour moved the pen back to the contour's start, so the `m` and every contour after it landed somewhere else. Such a contour now stays open as written; every other contour is still closed.
  - `parseFontStyle`, and so `enableLocalFontOutlines`, reads a lone `Demi` as 600, `DemiLight` as 350, and a numbered `W0`–`W9` weight (Hiragino Sans on macOS) as its number times 100, `W0` sharing 100 with `W1`. Before, all of them read as 400 and the faces of a family collided in one slot.
  - `loadShaper` tries again after a load that failed, and the outline tier imports `opentype.js` again after an import that failed. Before, one failed fetch left every later call failing for the rest of the session.
  - A closing bracket that starts a piece of text in its opening bracket's script is shaped in that script's direction, as its opening bracket was: the `)` of `שלום (abc)` is now shaped right to left.
  - Doc fixes: `DEFAULT_BAKE_BUDGET` names `subscribeGlyphReady`, and the bidi README says that `@weasel-js/text-shaping` depends on it.
- Updated dependencies [c9fb4d6]
  - @weasel-js/bidi@1.18.1

## 1.18.0

### Patch Changes

- Updated dependencies [5f9b5d0]
  - @weasel-js/bidi@1.18.0

## 1.17.3

### Patch Changes

- @weasel-js/bidi@1.17.3

## 1.17.2

### Patch Changes

- @weasel-js/bidi@1.17.2

## 1.17.1

### Patch Changes

- @weasel-js/bidi@1.17.1

## 1.17.0

### Patch Changes

- @weasel-js/bidi@1.17.0

## 1.16.2

### Patch Changes

- @weasel-js/bidi@1.16.2

## 1.16.1

### Patch Changes

- @weasel-js/bidi@1.16.1

## 1.16.0

### Patch Changes

- @weasel-js/bidi@1.16.0

## 1.15.2

### Patch Changes

- @weasel-js/bidi@1.15.2

## 1.15.1

### Patch Changes

- d2110bc: A baked atlas or canvas face is now shaped when its font file is registered too: call
  `registerFontOutlines` for the same family and variant beside `registerFont` or `registerCanvasFont`,
  and a registered shaper reads that file. A letter the shaping leaves as its own glyph still draws from
  the atlas. A shaped cluster (a Devanagari conjunct, an Arabic joining form, a placed mark) draws from
  its outline, and on a canvas face below the outline size from one tile the canvas tier bakes from that
  outline (`DynamicFace.requestShaped`). A baked atlas must be cut from the same file, or its advances
  disagree with the shaper's. PDF export writes such text as the shaped glyphs, where it used to leave
  the clusters out.
  
  A bracket that gives up its shaped glyph on an atlas face now draws its own glyph rather than nothing.
- @weasel-js/bidi@1.15.1

## 1.15.0

### Patch Changes

- 522f65a: `@weasel-js/text-shaping` no longer pulls a top-level `await` into a consumer's bundle, so an app bundling for a target below ES2022 (esbuild, Vite) builds. harfbuzzjs's JavaScript is vendored into the package with its `init` exported, and `loadShaper` instantiates the WebAssembly itself: in Node from the `harfbuzzjs` package, elsewhere from a `harfbuzz.wasm` the package now ships beside its JavaScript.
- @weasel-js/bidi@1.15.0

## 1.14.2

### Patch Changes

- 2817305: `shape` cuts text wherever its Unicode script changes, for every script, rather than between a fixed list of
  34 and lumping the rest into one piece: Cherokee beside Tifinagh, or Samaritan beside Cherokee, is now two
  pieces, each shaped in its own direction. A piece's direction comes from the `Bidi_Class` of its first strong
  letter, through `@weasel-js/bidi`, which is now a dependency. A closing bracket goes with the piece its
  opening bracket was in, so in `abc (שלום) def` the `)` is shaped with the Latin rather than mirrored with the
  Hebrew. Private-use and unassigned characters join the piece around them, as spaces and punctuation do.
- @weasel-js/bidi@1.14.2

## 1.14.1

No changes in this release.

## 1.14.0

### Patch Changes

- 2692828: New package `@weasel-js/text-shaping`: OpenType shaping through HarfBuzz. `await loadShaper()` loads its WebAssembly and resolves with a shaper; `registerShaper(shaper)` (from `@weasel-js/text`, re-exported by core) hands it to every text layout, and `layoutRuns` also takes one as `opts.shaper`. Text set in a face registered with `registerFontOutlines` from TrueType or OpenType bytes is then shaped: Arabic joins, Devanagari forms its conjuncts and places its vowel signs, marks sit where the face's `GPOS` puts them, and ligatures and the face's kerning come from the shaping. Text drawn from an atlas, or with no shaper registered, lays out as before.
  
  A shaped code point draws its whole cluster from its own pen, and the cluster's other code points take no width; `PlacedGlyph.shaped` carries what it draws. `fontVariantCaps: 'small-caps'` on a shaped face with an `smcp` feature now draws the face's own small capitals instead of synthesizing them, and `ResolvedRun` gains `fontFeatures` for it. This adds API: `registerShaper`, the `TextShaper`, `ShapedGlyph` and `ShapedCluster` types, `LayoutRunsOpts.shaper`, `ResolvedRun.fontFeatures` and `PlacedGlyph.shaped`.
- a2b1c7f: `@weasel-js/shape` is now `@weasel-js/text-shaping`, so its name says it shapes text rather than drawing shapes. Nothing in it changed: replace the import specifier and the dependency. `@weasel-js/shape` stays on npm at 1.13.0 and gets no further releases.
- ab41dea: A run and a node's `TextStyle` take `lang`, a BCP 47 tag (`'sr'`, `'ur-PK'`), and a shaped run is shaped in that language, so a face's forms for it are drawn: Serbian Cyrillic italics, Urdu digits, a Sindhi meem. A run's own `lang` overrides the node's. `TextShaper.shape` and `@weasel-js/text-shaping`'s `Shaper.shape` take it as an optional fourth argument, `language`, which `@weasel-js/text-shaping` sets on the HarfBuzz buffer. Two layouts differing only in language are cached apart. This adds API.
