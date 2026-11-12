# @weasel-js/bidi

## 1.19.0

### Patch Changes

- f533898: A paragraph separator handed to `analyze` mid-text ends every embedding, override and isolate open before it, as UAX #9's X8 says. Paragraph separators are a line feed, carriage return, U+001C–U+001E, U+0085 and U+2029. No isolate pairs with a `PDI` past one, and `'auto'` reads the paragraph's direction from before the first separator only.
  
  <!-- entry: fix -->

## 1.18.2

No changes in this release.

## 1.18.1

### Patch Changes

- c9fb4d6: Fixes to glyph outlines, local font weights, and loads that fail once.
  
  - A glyph outline whose parser leaves a contour open before a relative `m` keeps its contours in place. Closing that contour moved the pen back to the contour's start, so the `m` and every contour after it landed somewhere else. Such a contour now stays open as written; every other contour is still closed.
  - `parseFontStyle`, and so `enableLocalFontOutlines`, reads a lone `Demi` as 600, `DemiLight` as 350, and a numbered `W0`–`W9` weight (Hiragino Sans on macOS) as its number times 100, `W0` sharing 100 with `W1`. Before, all of them read as 400 and the faces of a family collided in one slot.
  - `loadShaper` tries again after a load that failed, and the outline tier imports `opentype.js` again after an import that failed. Before, one failed fetch left every later call failing for the rest of the session.
  - A closing bracket that starts a piece of text in its opening bracket's script is shaped in that script's direction, as its opening bracket was: the `)` of `שלום (abc)` is now shaped right to left.
  - Doc fixes: `DEFAULT_BAKE_BUDGET` names `subscribeGlyphReady`, and the bidi README says that `@weasel-js/text-shaping` depends on it.

## 1.18.0

### Patch Changes

- 5f9b5d0: Type fixes from an audit:
  
  - The text edit overlay waits for, and sets, a run's own family in the node's weight and style when the run names no weight or style of its own. It asked for 400 normal, so an edit in a bold node could show before its face had loaded.
  - `fontHold: 0` shows the edit overlay at once, as documented; it stayed transparent until a zero-length timer fired.
  - A numeric `startEdit` caret is placed by the same offset rules as every other selection in the overlay.
  - `unregisterCanvasFont` drops the family's glyphs still waiting to bake, so they no longer take atlas room.
  - Bidi reordering is linear in the number of tabs and separators on a line; it was quadratic.

## 1.17.3

No changes in this release.

## 1.17.2

No changes in this release.

## 1.17.1

No changes in this release.

## 1.17.0

No changes in this release.

## 1.16.2

No changes in this release.

## 1.16.1

No changes in this release.

## 1.16.0

No changes in this release.

## 1.15.2

No changes in this release.

## 1.15.1

No changes in this release.

## 1.15.0

No changes in this release.

## 1.14.2

No changes in this release.

## 1.14.1

No changes in this release.

## 1.14.0

No changes in this release.

## 1.13.0

No changes in this release.

## 1.13.0-rc.0

No changes in this release.

## 1.12.0

No changes in this release.

## 1.11.1

No changes in this release.

## 1.11.0

No changes in this release.

## 1.10.1

No changes in this release.

## 1.10.0

No changes in this release.

## 1.9.4

### Patch Changes

- 0a83dfb: Right-to-left text lays out in visual order everywhere once a bidi engine is registered: `registerBidi(bidi)` (from `@weasel-js/text` or `@weasel-js/core`, with `bidi` from `@weasel-js/bidi`) gives `layoutRuns` an engine to fall back on when its options carry none, so painting, picking, the caret, `measureTextBounds`, and `textToPath` all reorder.
  
  An omitted `direction` now means `'auto'` for alignment as well as for reordering: each paragraph's first strong character decides which edge `start` and `end` are. `TextStyle.direction` and `LayoutRunsOpts.direction` accept `'auto'`, `ResolvedTextStyle.direction` defaults to it, and a text command carries `direction` and the unresolved `align`. `paragraphDirection(text, direction)` answers which way a text reads.
  
  Breaking for a custom engine: `BidiResolver` gains `baseLevel(analysis)`, which `@weasel-js/bidi`'s `bidi` implements. `TextDrawCommand.align` and `TextPoseLayoutInput.opts.align` may now be `start`, `end`, or `justify`.
  
  The edit overlay states the same direction in CSS, and `@weasel-js/svg` writes the direction a text actually reads in and keeps a stated `ltr` through a round trip.

## 1.9.3

No changes in this release.

## 1.9.2

No changes in this release.

## 1.9.1

No changes in this release.

## 1.9.0

No changes in this release.

## 1.8.1

No changes in this release.

## 1.8.0

No changes in this release.

## 1.7.3

No changes in this release.

## 1.7.2

No changes in this release.

## 1.7.1

No changes in this release.

## 1.7.0

No changes in this release.

## 1.6.1

No changes in this release.

## 1.6.0

## 1.5.2

## 1.5.1

## 1.5.0

## 1.4.4

## 1.4.3

## 1.4.2

## 1.4.1

## 1.4.0

## 1.3.0

### Patch Changes

- 350dbd7: New package: the Unicode Bidirectional Algorithm
  
  `@weasel-js/bidi` implements UAX #9 as a standalone leaf — code points and a
  direction in, embedding levels and a visual order out. No fonts, no glyphs, no
  canvas, no DOM, and no dependencies.
  
  Nothing in weasel depends on it. A text layout that wants bidi is handed an
  implementation of `BidiEngine`; one that is not lays out in logical order, which
  is exactly what it does today. So a consumer who does not render right-to-left
  text never installs the Unicode tables, and the dependency runs the other way
  from the usual: `@weasel-js/text` will declare the interface, and this package
  satisfies it without either importing the other.
  
  The API is two calls, because the algorithm splits at exactly one place.
  `analyze` is per paragraph; `reorder` is per *line*, since L1 resets trailing
  whitespace against the end of a line rather than the end of a paragraph. A
  caller wraps between them and one analysis serves every line. `mirror` is L4,
  applied at paint time against a character's resolved level — the same code
  point mirrors in one run and not in another.
  
  Verified against Unicode's own conformance data in full: all 91,707 cases of
  `BidiCharacterTest.txt` and all 490,846 of `BidiTest.txt`, at Unicode 16.0.0.
  Character data is generated by `npm run gen:bidi-tables` and the version it was
  built from is exported as `UNICODE_VERSION`.
  
  Ordering only. Arabic still renders unjoined — joining forms are `GSUB`
  substitutions rather than a reordering, and belong to a shaping engine. Hebrew,
  Divehi and the other non-joining right-to-left scripts are complete with bidi
  alone.
