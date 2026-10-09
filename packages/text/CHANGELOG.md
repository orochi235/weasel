# @weasel-js/text

## 1.9.2

### Patch Changes

- @weasel-js/font@1.9.2
  - @weasel-js/geom@1.9.2
  - @weasel-js/paint@1.9.2

## 1.9.1

### Patch Changes

- @weasel-js/font@1.9.1
  - @weasel-js/geom@1.9.1
  - @weasel-js/paint@1.9.1

## 1.9.0

### Patch Changes

- Updated dependencies [718769e]
- Updated dependencies [3088756]
  - @weasel-js/paint@1.9.0
  - @weasel-js/font@1.9.0
  - @weasel-js/geom@1.9.0

## 1.8.1

### Patch Changes

- Updated dependencies [7e72192]
  - @weasel-js/geom@1.8.1
  - @weasel-js/font@1.8.1
  - @weasel-js/paint@1.8.1

## 1.8.0

### Patch Changes

- @weasel-js/font@1.8.0
  - @weasel-js/geom@1.8.0
  - @weasel-js/paint@1.8.0

## 1.7.3

### Patch Changes

- @weasel-js/font@1.7.3
  - @weasel-js/geom@1.7.3
  - @weasel-js/paint@1.7.3

## 1.7.2

### Patch Changes

- @weasel-js/font@1.7.2
  - @weasel-js/geom@1.7.2
  - @weasel-js/paint@1.7.2

## 1.7.1

### Patch Changes

- 8635031: Every text tier now places its baseline from the ascent and descent a browser
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
- a7f2103: Underline, strikethrough and super/subscript now follow the font's own metrics
  instead of fixed constants. `gen-font` bakes `post.underlinePosition` /
  `underlineThickness`, `OS/2.yStrikeoutPosition` / `yStrikeoutSize` and the
  `OS/2` super/subscript size and offset into a new optional `faceMetrics` block
  in the atlas JSON, and the outline parser reads the same values onto
  `OutlineFace.faceMetrics`, through one shared function, so an atlas and a TTF
  of one font place rules and scripts identically. The overline keeps its
  default offset and takes the underline's weight. A face with no metrics
  (older atlases, the canvas tier, custom parsers) keeps the previous constants.
  
  This changes rendering for the bundled Inter: its underline sits lower
  (0.170 em, was 0.10) and heavier (0.068 em, was 0.05), and `script: 'sub'`
  drops by 0.075 em instead of 0.333 em, with scripts at 60.0% size. The
  committed atlases are rebaked; the PNG is byte-identical.
  
  Additive API: `faceMetricsFromTables`, `faceMetricsOf`, `faceMetricsFor` and
  the `FaceMetrics` types in `@weasel-js/font`; `scriptMetrics`,
  `scriptMetricsFor`, `decorationMetrics` and `DEFAULT_DECORATION_METRICS` in
  `@weasel-js/text` (re-exported from core); an optional `faceOf` argument to
  `layoutMarkdown` and an optional `face` on `PositionedRun`. `SCRIPT_METRICS`
  remains, now documented as the fallback rather than what every run gets.
  
  Fix: `resolveFontVariant` called from inside the glyph-ready notification of
  an atlas that just landed returned a pending miss, because the load was still
  marked in flight. A subscriber that re-resolves synchronously, as
  `useSyncExternalStore` does, now sees the face.
- edabd62: `layoutRuns` no longer warns "no metrics for …" about a face whose registration is still loading — an un-awaited `registerFont`, or an outline face whose bytes have not arrived. It warns once that registration settles and the face still resolves to nothing. New `fontPending(family, weight?, style?)` answers whether a registration in flight could still serve a request. A failed `registerFont` or outline load now fires `subscribeGlyphReady`, so text laid out while it was pending gets laid out again.
- 1524403: Text now ends a line at every UAX #14 hard break, not only at `\n`: CR, CRLF
  (one break, not two), VT, FF, NEL, U+2028 LINE SEPARATOR and U+2029 PARAGRAPH
  SEPARATOR. This applies to `layoutRuns`, `layoutMarkdown` and the edit overlay,
  wrapped or not. None of them lays out a cell, and a caret offset on either side
  of a CRLF stays exact. As with `\n`, and as with a forced break in CSS, the
  line a hard break ends is never spread by `justify`; U+2028 and U+2029 behave
  the same way here. This is a behavior change: text holding those characters
  lays out on more lines than before.
  
  The edit overlay writes each hard break the browser would not break at as a
  `<span data-break>` holding a newline, and reads the original character back
  on commit, so an edit no longer turns U+2028 into a space or a lone CR into a
  newline. A node without runs is now seeded with text nodes instead of through
  `innerText`, which also puts the caret at the right offset on any line after
  the first.
  
  Additive: `isHardLineBreak(codePoint)` in `@weasel-js/text`.
- b94d2ca: `layoutMarkdown`, and so `createMarkdownRenderer`, wraps at the same UAX #14
  break opportunities as `layoutRuns` instead of only at spaces: after a hyphen,
  between CJK characters, and never before `!`, `?` or a closing bracket. The
  opportunities are found across run boundaries, so a word split between two
  styled runs no longer breaks at the seam. As in `layoutRuns`, only a word's
  ink has to fit on the line, and the spaces after it hang. This is a behavior
  change with no API change: markdown text may wrap differently than before.
- 8d0493a: `measureText` wraps where `layoutRuns` does. It used to break only at
  whitespace and at `\n`; it now breaks at the same UAX #14 opportunities —
  after a hyphen, between CJK characters, never before `!`, `?` or a closing
  bracket — and ends a line at every hard break (CR, CRLF as one, VT, FF, NEL,
  U+2028, U+2029), none of which appears in `lines`. Only a word's ink has to
  fit, and trailing spaces hang.
  
  Its return shape is unchanged, but this is a behavior change: the same text
  may wrap into different lines. Three edges move with `layoutRuns` too: empty
  text returns no lines rather than one empty line, a trailing hard break opens
  no empty line after it, and a trailing tab stays in its line, since only
  spaces hang.
  
  `layoutRuns`, `layoutMarkdown` and `measureText` now share one wrap loop, so
  the three cannot drift apart again.
- 16a0476: Text runs carry a numeric weight. `StyledRun.fontWeight` (100–900) overrides the node's weight and the `bold` flag, which is now a preset over it: writing either one to a range drops the other. `numericWeight` and `isBoldWeight` (600 and up) are exported as the one reading of a weight.
  
  Taking bold off part of a bold node now writes `fontWeight: 400` over that part and leaves the node alone, instead of lowering the node and re-bolding the rest — so it works at any node weight, including 900, where it used to be refused. `SetFlagResult.applied` is gone, since the edit can no longer be declined. `effectiveRangeStyle` reports the `fontWeight` that renders and reads `bold` off it; `patchRangeStyle` lays an armed style over a range the way a write would.
  
  `listFontWeights(family)` in `@weasel-js/font` reports the weights a family has on the atlas and outline tiers. A new `font-weight` pref kind draws `FontWeightSelect`, which lists those weights (the nine CSS weights for a family with none on file) and reads the family from the `fontFamily` leaf beside it. The text tool's character options and the node panel's Weight field both use it. The overlay and SVG round-trip a run's weight; a tspan `font-weight` other than 700 now reads as the run's weight rather than being dropped.
- 4cb55b7: Text can be set in small caps. `StyledRun` and `TextStyle` take
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
- fe9a91e: Add `warmSvg(nodes)` and `svgNeeds(nodes)` to `@weasel-js/svg`. `serializeSvg` is synchronous, and its missing-def warning used to point at `warmPaintKinds()`, which loads every lazily registered kind and fails when any unrelated one does. `svgNeeds` reads the serializer's own paint pre-pass, so it lists exactly the paint kinds the export writes as paint servers — fills and strokes, text and run paints, through nested groups — plus the faces whose font metrics size a sub- or superscript run with its own `baselineShift`. `warmSvg` loads only those. Core now exports `isPaintKindKnown`, and `@weasel-js/text` (re-exported by core) adds `resolveRunFace(run, style)`, the family, weight and style a run is set in, read without touching the font registry. Additive.
- 3a68365: Add justified text. `TextAlign` gains `'justify'`: every line that wraps is
  spread across the box by widening its word gaps equally, and a paragraph's last
  line, or a line with no gap, sits at the start edge. `resolveAlign` maps
  `justify` to that start edge. `LayoutRunsOpts.justify` and
  `TextDrawCommand.justify` carry justification apart from the edge, so
  `justify: true` with `align: 'center'` centers the last lines instead (CSS
  `text-align-last`). The edit overlay sets `text-align: justify` and pins
  `text-align-last` to the same edge, and the property panel's Align bar gets a
  Justify segment with a new `textAlignJustify` icon. SVG export writes a
  justified node at its start edge and records `data-weasel-align="justify"`,
  which the reader turns back into `align: 'justify'`.
  
  This is additive. Code that switches over `TextAlign` exhaustively has a new
  value to handle.
- 351271a: `letterSpacing` is now added once per grapheme cluster on every path, which is
  how CSS `letter-spacing` counts and so how the DOM edit overlay already
  tracked. `layoutRuns` used to track per code point and `measuredWidth` per
  UTF-16 unit, so text with combining marks, ZWJ emoji sequences or (on the 2D
  path) astral characters measured wider than the overlay showed it, and the 2D
  and GL paths could wrap such a line differently. This is a behavior change:
  tracked text containing those characters is narrower than before and may wrap
  at a different word. Untracked text is unaffected.
- 59f4365: `layoutRuns` wraps at the break opportunities of the Unicode Line Breaking
  Algorithm (UAX #14, Unicode 16.0) instead of only at spaces, so a wrapped line
  breaks after a hyphen or between CJK characters where the browser does, and the
  edit overlay no longer reflows such a line when an edit opens. It also stops
  breaking where UAX #14 forbids a break even after a space, such as before `!`,
  `?`, `,` or a closing bracket. This is a behavior change: text with those
  characters may wrap differently than before. Text of words, spaces and
  word-final punctuation wraps exactly as it did. A word wider than the line
  still overflows rather than breaking inside itself.
  
  Additive: `lineBreakOpportunities(codePoints)` returns, for each position, one
  of `NO_BREAK`, `BREAK_ALLOWED` or `BREAK_MANDATORY`, for a consumer running its
  own line fitting. It passes all of Unicode's `LineBreakTest.txt`.
- Updated dependencies [f457e7c]
- Updated dependencies [8635031]
- Updated dependencies [3d80c9f]
- Updated dependencies [a7f2103]
- Updated dependencies [edabd62]
- Updated dependencies [7be3713]
- Updated dependencies [b2fd89a]
- Updated dependencies [4212d2d]
- Updated dependencies [b5cc59f]
- Updated dependencies [3c1def2]
- Updated dependencies [9cad63b]
- Updated dependencies [b228015]
- Updated dependencies [365c762]
- Updated dependencies [16a0476]
- Updated dependencies [63d0ece]
- Updated dependencies [dde2315]
- Updated dependencies [4cb55b7]
- Updated dependencies [09ff2c1]
- Updated dependencies [637945e]
  - @weasel-js/geom@1.7.1
  - @weasel-js/font@1.7.1
  - @weasel-js/paint@1.7.1

## 1.7.0

### Patch Changes

- 793987a: `TextStyle.script: 'super' | 'sub'` sets a whole text node as a superscript or subscript. It is the default every run inherits, the way `StyledRun.script` is for one run, and a run naming its own script replaces it.
  
  A run shrunk by a relative size (`script` or `fontScale`) now holds its line open at the size it inherited: `ResolvedRun.strutSize` carries that size, and layout measures the line's height and baseline from it. A superscript alone on a line used to collapse the line to the superscript's own size, which contradicted the rule that a shifted run rides its line rather than reflowing it.
  
  The edit overlay shows a node-level script, and now shows a node-level overline, which it had been dropping. The SVG writer puts a node-level script on `<text>` as `baseline-shift`, which the reader already carries onto every run.
- Updated dependencies [ad0378f]
- Updated dependencies [da20f95]
- Updated dependencies [fc3de06]
- Updated dependencies [6357f14]
- Updated dependencies [a028cc3]
  - @weasel-js/geom@1.7.0
  - @weasel-js/paint@1.7.0
  - @weasel-js/font@1.7.0

## 1.6.1

### Patch Changes

- @weasel-js/font@1.6.1
  - @weasel-js/geom@1.6.1
  - @weasel-js/paint@1.6.1

## 1.6.0

### Patch Changes

- f792755: `createMarkdownRenderer` paints underline, strikethrough and overline, placed and weighted by the same metrics as the GL text tier, one rule across contiguous runs that share decoration, size, baseline and fill. It also takes `StyledRun[]` as well as markdown, since markdown has no spelling for those three, and lays a block out from its left edge under the context's `textAlign`, so a multi-run line no longer overlaps itself under `center` or `right`. `PositionedRun` gains `width`.
- d975afa: `text-transform` for styled runs and text nodes
  
  `StyledRun` and `TextStyle` gain `textTransform: 'none' | 'uppercase' |
  'lowercase' | 'capitalize'`, with CSS semantics. A run's value overrides the
  node's, and `'none'` on a run turns an inherited transform off. Only what is
  drawn changes: a run's `text` stays as authored, so carets, selections and
  edits still address the source.
  
  - Case mapping uses JavaScript's locale-independent full mappings, so `ß`
    uppercases to `SS` and a word-final `Σ` lowercases to `ς`. `capitalize`
    titlecases the first letter of each word (`ǆ` → `ǅ`, `ß` → `Ss`) and leaves
    the rest alone; word starts come from `Intl.Segmenter`, the same boundaries
    browsers use, and are found across run boundaries.
  - `resolveRuns` applies the transform, so `ResolvedRun.text` is the drawn
    text. When a transform changes a length, the run carries `srcMap`: where
    each drawn UTF-16 unit came from in the source. Layout reads each cell's
    `srcIndex` / `srcEnd` off it, so both cells of an uppercased `ß` map to the
    one source character, and `caretIndexAt` treats them as one stop.
  - `transformRunTexts` is exported for callers laying text out themselves;
    `layoutMarkdown` uses it.
  - The range helpers (`applyStyleToRange`, `styleAtRange`,
    `effectiveRangeStyle`) carry the new key, the text tool and the node's
    Character properties offer it as "Case", and the edit overlay shows it with
    CSS `text-transform` on the overlay and on each run span.
  - `@weasel-js/svg` writes it as `style="text-transform:…"` on `<text>` and
    `<tspan>` — it is a CSS property, not an SVG 1.1 presentation attribute — and
    reads it back from either spelling or an ancestor.
- Updated dependencies [c373af4]
- Updated dependencies [bfe6a4f]
- Updated dependencies [6857b4d]
- Updated dependencies [b1c30bc]
- Updated dependencies [9aa63a1]
  - @weasel-js/paint@1.6.0
  - @weasel-js/font@1.6.0
  - @weasel-js/geom@1.6.0

## 1.5.2

### Patch Changes

- 24a2dae: Close the places where two tiers spelled one concept differently.
  
  **A fixed pan bug.** `viewport.dragPan` fell back from `drag.screenDelta` to
  the world `drag.delta` and then divided by the zoom anyway, panning at
  1/scale² for any event source that supplies no `clientX`/`clientY` — which is
  every synthesized `InputEvent`, since those fields are optional. It now
  reconstructs the client delta exactly, by undoing each end of the world delta
  against the view that produced it.
  
  **Breaking, renames.** `ClickEvent`, `DoubleClickEvent` and `ContextMenuEvent`
  carry their world point as `x`/`y`, matching every other kind in `InputEvent`;
  `worldX`/`worldY` are gone, and a consumer who set `x`/`y` no longer silently
  lands at the origin. All three now also carry `clientX`/`clientY`, so a
  context-menu action can finally read `ctx.screen` — the case that surface was
  added for. The renderer's `Mat3` is `GlMat3`, freeing `Mat3` to mean geom's
  affine in a file that imports from both. `translatePolygonInPlace` is
  gone: it was the one sanctioned writer into a committed path's coord buffer,
  documented as overlay-only, and nothing called it. `@weasel-js/font` exports `FontStyle`
  in place of `OutlineFontStyle`. `@weasel-js/labkit` no longer exports
  `useOrbit`, `OrbitView`, `Vec3` or their helpers: `@weasel-js/kernel3d` owns
  the orbit camera and `@weasel-js/geom/3d` owns `Vec3`. `ToolCtx.screenPoint`
  was declared and never written by anything; it is gone.
  
  **Breaking, types narrowed.** geom's `Mat3` and `Box` are readonly tuples,
  matching the reason `geom/3d` already gives for its own. `History.entries()`
  returns `readonly` arrays, which is what its docstring always asked callers to
  assume.
  
  **One type where there were two.** `@weasel-js/svg`'s `Matrix` is geom's
  `Mat3`, and its duplicate `multiply` is geom's; `SvgStroke.width` is
  `ScreenLength` rather than that union written out again. `kernel3d`'s
  `ViewportRect` is `ScreenBox` — one rectangle spelling instead of `w`/`h`
  beside `width`/`height` eight lines apart. The renderer's `View` is routing's.
  Core's `Vec2` is routing's `Point2`, and `Pt` is gone from the barrel.
  
  **Additions.** `oklchDegToHex` / `hexToOklchDeg` / `OklchDeg` in
  `@weasel-js/paint` — the degrees-and-hex form `@weasel-js/ui` and
  `@weasel-js/theme` had each built for themselves. `srgbFloatToOklab`, for
  callers holding 0..1 floats; feeding those to `srgbU8ToOklab` truncated where
  paint's own internal conversion rounds. `mat3.toAffine` / `mat3.fromAffine`
  name the repack between the GL layout and geom's.
  
  **Corrections.** `RECT_POSE_DESCRIPTOR` implements `getRotation`, so a pose it
  rotated no longer reports itself unrotated to `useResize` and to diagram's port
  placement. `ToolDef.capabilities` is documented as reaching
  `Tool.eligibility.capabilities`, which is where it actually goes — following
  the old text gave `undefined`, and `eligibleForMode` turns that into a tool
  that vanishes from every mode. `MultitouchEvent.centroid` is documented as
  canvas-local, which is what the dispatcher hands over. `drag.points` is a
  snapshot on `onEnd` rather than the dispatcher's live accumulator.
  
  `tsconfig.json` now typechecks `packages/routing`, `cursor`, `bidi` and
  `loupe`, which it had never included.
- 15b798e: `layoutMarkdown` honors `script`, `fontScale` and `baselineShift`. The
  2D-canvas path behind `renderLabel` read a run's absolute `fontSize` and
  nothing else, so a superscript laid out and painted at full size on the
  baseline. `PositionedRun` now carries a resolved `size` and a per-run `y`,
  resolved the way `resolveRuns` resolves them for the GL path — an absolute size
  wins over a multiplier, and the rise is measured against the inherited size so
  it does not shrink along with the run. The painters read both, so layout and
  paint can no longer disagree about a run's size.
- Updated dependencies [24a2dae]
- Updated dependencies [8ffd746]
- Updated dependencies [ad6c351]
  - @weasel-js/geom@1.5.2
  - @weasel-js/paint@1.5.2
  - @weasel-js/font@1.5.2

## 1.5.1

### Patch Changes

- b981856: Accept `{ px }` screen-pixel sizes for `fontSize` and `letterSpacing`
  
  `TextStyle.fontSize`, `TextStyle.letterSpacing` and their `StyledRun`
  counterparts now take `number | { px: number }`, the spelling `Stroke.width`
  and `MarkerRef.size` already had. A `{ px }` size holds its on-screen size as
  the view zooms, so a label no longer divides by the view scale at the call
  site.
  
  The unit is one type and one resolver now: `ScreenLength` and
  `resolveScreenLength` live in `@weasel-js/paint`, which both core and text
  already depend on, and `resolveStrokeWidth` delegates to it.
  
  Resolution happens at the entry to layout, not at draw time. A screen-pixel
  size changes the glyph advances and so the wrap points and the measured
  bounds, so `resolveTextStyle`, `resolveRuns`, `textPoseLayoutInput`,
  `layoutTextPose`, `measureTextBounds` and the three command builders
  (`textCommand`, `textCommandFromRuns`, `textCommandFromPose`) each take the
  view scale, defaulting to 1. `ResolvedTextStyle` and `ResolvedRun` keep plain
  world numbers, so everything downstream is unchanged.
  
  `createTextLayer` passes the mean of `view.scale.x` and `view.scale.y`, so
  non-scene text gets this with no consumer change. The `kit:text` node painter
  deliberately does not: it memoizes on `(data, pose)` to keep the renderer's
  layout cache hitting across frames, and keying that on the live camera would
  miss on every zoom frame.
  
  SVG serialization writes a `{ px }` size as that many user units — SVG user
  space has no camera — and the fit clamp on import leaves one alone, since a
  screen-pinned size is not the file's to scale.
- Updated dependencies [f644eac]
- Updated dependencies [626bace]
- Updated dependencies [b981856]
  - @weasel-js/paint@1.5.1
  - @weasel-js/font@1.5.1
  - @weasel-js/geom@1.5.1

## 1.5.0

### Patch Changes

- 0f374d8: `kit:text` nodes with `align: 'center'` or `'right'` now align within
  `pose.width`. They were anchored on `pose.x`, so centered text hung half outside
  the left edge of its box and right-aligned text ended at that edge.
  
  Alignment has its own width, separate from the wrap width:
  `LayoutRunsOpts.alignWidth` and `TextDrawCommand.width`, both defaulting to
  `maxWidth`, and a trailing `width` argument on `textCommand` /
  `textCommandFromRuns`. The painter passes its pose width there and still does
  not wrap. `textLineBoxes` and `caretIndexAt` align within `pose.width` even at
  `maxWidth: Infinity`, so the silhouette and the caret follow the paint. A
  `layoutRuns` call or text command that sets no alignment width lays out exactly
  as before.
- deb9e79: Text wraps only where its style says so, and everything that lays a text node
  out now agrees. `TextStyle.wrap` (default `false`) breaks lines between words
  at the pose width; without it a line runs as long as its text and the width
  only resolves `align`.
  
  Before this, `kit:text` never wrapped while `createTextLayer`, `textLineBoxes`,
  `caretIndexAt`, `fitTextPose` and the edit overlay all wrapped at the pose
  width. Opening an edit on a `kit:text` line longer than its box reflowed it,
  and a double-click could put the caret on a line the canvas never drew.
  
  **Breaking:**
  
  - `createTextLayer` and `fitTextPose` (`axis: 'height'`) no longer wrap unless
    the style sets `wrap: true`. Add it to text that should keep wrapping.
  - `TextLineBoxesOpts.maxWidth` and `caretIndexAt`'s `opts` argument are gone,
    along with the `CaretIndexAtOpts` type. Both read `style.wrap`.
  - The edit overlay is `white-space: pre` for unwrapped text, sized to its
    content, and never breaks inside a word in either mode.
  
  New: `layoutTextPose` and `textPoseLayoutInput` in `@weasel-js/text`, and
  `textCommandFromPose` in `@weasel-js/core`, which `kit:text` and
  `createTextLayer` both emit. `textLineBoxes` and `caretIndexAt` now resolve
  `align: 'start' | 'end'` against `direction` as the painters do, and
  `useSceneTextEdit` maps a double-click through the node's `verticalAlign`
  (`getVerticalAlign` for custom data), which it used to ignore. SVG export
  writes `data-weasel-wrap="true"` and import reads it back.
- Updated dependencies [7586835]
- Updated dependencies [2f1ddd0]
- Updated dependencies [aa45d32]
  - @weasel-js/geom@1.5.0
  - @weasel-js/font@1.5.0
  - @weasel-js/paint@1.5.0

## 1.4.4

### Patch Changes

- Updated dependencies [4f8c6b2]
  - @weasel-js/font@1.4.4
  - @weasel-js/geom@1.4.4
  - @weasel-js/paint@1.4.4

## 1.4.3

### Patch Changes

- fc16cac: `Stroke.paint` is optional, and a stroke without one paints nothing everywhere
  rather than throwing.
  
  Such a stroke is real: a property panel that writes one field onto a node with
  no stroke — a width, a cap — materializes a whole stroke around it, and
  documents written before that was fixed still hold them. The painters already
  read one as no stroke. Every other reader dereferenced `paint` unguarded, so a
  document holding one threw on SVG export, on copy, and out of any consumer
  painter or overlay whose command reached the renderer directly.
  
  The type says so now, which is what stops the next reader from assuming
  otherwise. What each one does with an unpainted stroke:
  
  - The renderer skips the stroke pass and paints the fill.
  - The SVG serializer emits no `stroke` attributes at all, the way it already
    does for an absent or zero-width stroke.
  - Text layout keys it as no stroke, so an unpainted run groups with unstroked
    ones instead of splitting a draw call, and does not get pulled onto the
    outline tier to stroke nothing.
  - `setStrokeOpacity` seeds the default stroke color to have something to set an
    opacity on, keeping the width and joins already there.
- 995fde2: A text node's `data.fill: null` is now an explicit no-fill, so stroked-but-
  unfilled text — outline-only display type — renders as such.
  
  Every other node kind already read `null` that way. Text resolved it back to the
  default black, because a `ResolvedRun` had to name a concrete `FillStyle` and
  nothing downstream could skip the fill pass. `ResolvedRun.fill`,
  `ResolvedTextStyle.fill` and `LaidOutGroup.fill` are now `FillStyle | null`, and
  `TextPaint.fill: null` carries through to all three. Absent still means the
  default black.
  
  An unfilled run paints through its stroke alone, which only the outline tier can
  lay down, so layout emits no atlas quads for one and the renderer skips the
  glyph-fill mesh — an unfilled, unstroked run emits nothing at all, not even its
  outline geometry. Underline, strikethrough and overline follow the fill: a rule
  is a solid rect with no stroked counterpart, so an unfilled run draws none.
  Nothing changes for text that has a fill.
  
  Picking deliberately does not follow. `kit:text` still reports `filled: true`
  for `fill: null`, because a text node's silhouette is its line boxes rather than
  its glyph ink — reporting it unfilled would leave a word grabbable within a
  stroke width of a box edge and nowhere near the letters.
  
  `@weasel-js/svg` reads and writes SVG's own spelling of this: `<text
  fill="none">` parses to `fill: null` instead of being dropped as absent, and a
  text node with `fill: null` serializes as `fill="none"` rather than as SVG's
  default black. `SvgTextNode.fill` widens to `FillStyle | null`.
  
  The "Text outlines" demo has a Fill checkbox alongside its Stroke one; the two
  off together is a node with no glyph paint at all.
- Updated dependencies [fc16cac]
  - @weasel-js/paint@1.4.3
  - @weasel-js/font@1.4.3
  - @weasel-js/geom@1.4.3

## 1.4.2

### Patch Changes

- c93aa91: A run laid out without a `baselineShift` no longer comes back at NaN.
  
  `resolveRuns` always sets the field, but `layoutRuns` takes `ResolvedRun[]` and
  callers do hand-build them — the authored run type has had `baselineShift`
  optional all along. Absent it, `lineBaselineY - run.baselineShift` went NaN, and
  only on the vertical axis: every quad kept its correct `x` and UVs and lost
  `y0`, `y1` and `baselineY`.
  
  That fails in the worst available way. The glyphs draw as zero-area quads, so
  there is no GL error, no console warning, the atlas texture uploads normally and
  the layout reports the right number of groups and quads — the text simply is not
  there. The nightly performance suite had been red on it for a week with
  `text: rendered nothing, so every cell holding it is meaningless`, which is that
  suite's guard against exactly this class of silent free measurement doing its
  job.
  
  The subtraction now reads the field as `?? 0`, which is both the identity and
  what the authored type already implied.
- @weasel-js/font@1.4.2
  - @weasel-js/geom@1.4.2
  - @weasel-js/paint@1.4.2

## 1.4.1

### Patch Changes

- @weasel-js/font@1.4.1
  - @weasel-js/geom@1.4.1
  - @weasel-js/paint@1.4.1

## 1.4.0

### Patch Changes

- Updated dependencies [a7fa697]
  - @weasel-js/geom@1.4.0
  - @weasel-js/font@1.4.0
  - @weasel-js/paint@1.4.0

## 1.3.0

### Patch Changes

- 5c8e9e6: Reword the missing-bidi-engine warning so it no longer embeds a quoted
  `import … from "@weasel-js/bidi"` statement. The guidance is unchanged; only
  the phrasing is.
  
  labkit's consumer smoke test greps its bundled `dist` for that exact shape to
  prove the bundle is self-contained, and a string literal spelling it out was
  indistinguishable from a real leaked specifier. The check had been failing
  since the warning landed.
- 0f936da: Keep a hung trailing space out of `bounds.width`
  
  A line that wraps keeps the space it broke at. Alignment already hangs that
  space past the aligned edge — `inkWidth` has excluded it since hanging went in
  — but `bounds.width` folded the full advance width, so a block wrapped at
  `maxWidth` reported wider than the box it had just been fitted into.
  
  Anything that scales text to fit reads that overshoot as real and shrinks the
  text by it. One consumer measured up to 9.4% too small on wrapped strings, and
  it is silent: the glyphs land in the right places, so a visual baseline suite
  sees nothing.
  
  `bounds.width` now folds `inkWidth`, the value alignment already uses. Line
  boxes are unchanged: `x1` still includes the hung space, because it doubles as
  the caret stop that closes the line and a caret belongs after the space, not
  on it.
- 4180095: layoutRuns warns when a run resolves no metrics at all
  
  A run whose family resolves to neither an atlas nor an outline face was
  skipped in silence. Downstream that is indistinguishable from empty text —
  no groups, no bounds, no diagnostic — so a consumer sees a blank canvas and
  has nothing to search for.
  
  The tier already warns per missing glyph. This is the same warning one level
  up: it names the family and variant, says that neither tier resolved, and
  points at the registration calls. It fires once per family variant.
  
  It also names the cause that produces this without any mistake in consumer
  code: two copies of `@weasel-js/font` in `node_modules`. The registry is
  module state, so a second copy is a second, empty registry — the consumer
  registers a face into one while `layoutRuns` reads the other, and every run
  is skipped.
- 52c7b2a: Depend on `font` and `core` as exact peers
  
  `@weasel-js/font` and `@weasel-js/core` keep registries that consumer code
  writes into — registered faces and glyph-ready subscribers in one, content
  handlers and paint kinds and shape painters in the other. Two physical copies
  in a tree are two registries, so a face registered into one while layout
  resolves against the other lays out nothing and the canvas is blank.
  
  Exact sibling pins are what produced the duplicate: a consumer mixing two
  weasel releases left npm no choice but to nest a second copy, silently. As
  peers, the same mix is an `ERESOLVE` at install time. `font` is now a peer of
  `core`, `hud` and `text`; `core` is now a peer of `svg`, joining `d3`, `hud`
  and `ui`, whose `>=` ranges tighten to exact so no version mix resolves by
  accident.
  
  **This can break an install that currently succeeds.** Anyone resolving a
  mixed set of weasel versions by luck now gets an install error instead of a
  blank canvas. That is the point, but it is a break.
  
  `labkit` deliberately keeps `core` as an ordinary dependency: its build aliases
  every core entry point to core's built files and inlines them, so it never
  resolves core at the consumer and has nothing to peer. The flip side is that
  labkit ships its own copy of core's registries, so a consumer using both still
  has two — this change does not address that.
- c6c499d: Text layout is computed once, and the caret reads the layout that was painted
  
  The paint, the pose silhouette and the click-to-edit caret each ran their own
  walk. The paint went through a memoized `layoutRuns`; the silhouette re-ran
  `layoutRuns` on every pose change, because it allocates a fresh `ResolvedRun[]`
  per call and the cache keyed on array identity; and the caret summed
  `ctx.measureText` per character, which sees no kerning, reads system fonts
  rather than the registered face, and ignores per-run styling entirely. The
  caret could therefore answer with a different line, and a different glyph, than
  the one under the pointer — masked in practice only because it asked a WebGL
  canvas for a 2D context and got `null`, degrading silently to no caret at all.
  
  `cachedLayoutRuns` now lives in `@weasel-js/text` beside the function it caches,
  and all three go through it. It keeps the array-identity `WeakMap` as the
  renderer's zero-cost path and falls through to a bounded LRU keyed on the runs'
  structure, which is what lets a caller that cannot hold a stable array hit it —
  about 230× cheaper than laying out again, at roughly 4× the cost of the
  identity hit. `LaidOutLineBox` carries the caret stops the pen produced, so
  snapping is to the advance cells the glyphs were actually painted in.
  
  **Breaking:** `caretIndexAt(ctx, x, y, pose)` is now
  `caretIndexAt(x, y, pose, opts?)` — the `CanvasRenderingContext2D` is gone, and
  an optional `maxWidth` mirrors `textLineBoxes` for nodes the `kit:text` painter
  draws unwrapped. `useSceneTextEdit` no longer acquires a 2D context, so a
  double-click always seeds the caret instead of falling back to editing from
  offset 0. `@weasel-js/text` gains a `./test-seams` entry point exporting
  `_resetLayoutCacheForTests`.
- 68069dc: Right-to-left text lays out in visual order
  
  `LayoutRunsOpts` takes an optional `bidi` engine. Given one, `layoutRuns`
  analyses the paragraph, reorders each line after the wrap, and mirrors brackets
  in right-to-left runs. Given none, nothing changes: text lays out logically,
  exactly as before.
  
  `@weasel-js/text` declares the `BidiResolver` interface and does not depend on
  `@weasel-js/bidi` — the dependency runs the other way from the usual, so a
  consumer who renders no right-to-left text never installs the Unicode tables,
  and a different implementation can be substituted. `@weasel-js/bidi` is a
  devDependency here only, for a test that drives real Hebrew through the real
  engine; types lining up is not evidence the semantics do.
  
  `LaidOutCell` gains `advance` and `level`, and **`x` is no longer monotonic
  across `cells`**. Cells stay in logical order — slot `i` is still character `i`
  — while their x values follow the reordering. Sort on `x` for visual order, and
  read a cell's extent as `[x, x + advance)` rather than reaching for the next
  cell's `x`. Hit-testing was doing exactly that and now sweeps in visual order
  against each cell's own extent, taking a right-to-left cell's visually-leading
  half as the character's logical end.
  
  Kerning is a gap between two adjacent characters, and the wrap measures it
  logically. Reordering can put a different pair side by side, so the gap taken
  is the one belonging to whichever of the two is logically second, and none at
  all across a direction boundary — where the pair never touched in the source.
  
  Laying out right-to-left text with no engine now warns once, naming the import.
  The alternative is glyphs silently appearing reversed, which is the one real
  hazard of making this opt-in.
- 5d0ff9c: Every code point on a line gets a cell
  
  `LaidOutLineBox` replaces its `caretXs` / `caretIndices` pair with
  `cells: LaidOutCell[]` plus a `srcEnd` closing offset. A cell carries
  `srcIndex`, `srcEnd`, `cp`, `x` and `drawsInk`, so slot `i` is `cells[i]` and
  a consumer indexing per character no longer has to reconcile a sparse array
  against the source string.
  
  The old arrays were documented as non-contiguous, and two causes were real:
  
  - A code point no tier could serve was dropped outright, taking its caret stop
    with it. It now occupies a zero-advance cell. This is reachable whenever the
    dynamic canvas fallback is off — which is the normal configuration for a
    consumer registering its own outlines, where the outline tier has no rung
    below it.
  - A space opening a line — at the start of the text, or after a newline — was
    discarded. It now keeps its cell and still consumes no width, so a line is
    addressable per character without gaining an indent. A space that opens a
    *wrapped* line was never affected: the wrap leaves it as a trailing cell on
    the line before.
  
  Neither changes any geometry: both cells carry zero advance, zero tracking and
  no kerning, so bounds, line widths and glyph positions are unchanged.
  
  A newline still has no cell, since it separates cells rather than being one.
  `srcEnd` is what a blank line carries in its place.
  
  `drawsInk` is a property of the code point and the face, not of the call that
  produced it: it does not flip when a dynamic bake lands or the outline
  threshold is crossed, so the same text reports the same slots every time. A
  zero-advance combining mark is `true` — it inks without advancing.
- 0bb27a5: Trailing whitespace hangs past the aligned edge
  
  A centered or right-aligned line was positioned on its full advance width,
  so a line that happened to end in a space sat half a space off from an
  identical line that did not. CSS hangs trailing whitespace and aligns on the
  ink; this now does the same.
  
  The space keeps its cell and its advance and simply hangs past the aligned
  edge, so nothing about the per-code-point cell mapping changes. Left-aligned
  lines were never affected.
- c2ffa49: Alignment can resolve against reading direction
  
  `align` gains `start` and `end` alongside `left` / `center` / `right`, and
  `TextStyle` gains `direction: 'ltr' | 'rtl'`. The split is CSS `text-align`'s:
  the relative pair resolves against the direction, the absolute pair ignores it.
  `resolveAlign(align, direction)` collapses one to the other and is exported for
  consumers that need an edge rather than an intent.
  
  Direction is an input, not something this package discovers. `@weasel-js/text`
  has no DOM, so a consumer that reads `getComputedStyle(box).direction` passes
  what it found; nothing here sniffs an environment.
  
  Defaults are unchanged — `align: 'left'`, `direction: 'ltr'` — so no existing
  layout moves. Making `start` the default alignment is a separate call.
  
  `@weasel-js/svg` carries the direction through: `direction` joins the
  inheritable presentation properties, and `text-anchor` is now written and read
  against it. Two things were wrong before and are worth naming, because both
  rendered plausible output:
  
  - `align: 'start'` serialized to `text-anchor="end"` — the opposite edge — via
    a mapping that assumed three values and read the fourth as its `else`.
  - SVG's initial `text-anchor` is `start`, which under `direction="rtl"` is the
    right edge, while this model's default `align` is `left`. They agree under
    `ltr` and only there, so an RTL document with no explicit anchor imported as
    left-aligned.
  
  This is alignment and round-tripping only. Layout still walks code points in
  logical order with the pen always increasing: there is no bidi reordering and
  no shaping, so a Hebrew or Arabic string aligns to the correct edge and still
  renders in logical order, and Arabic still renders unjoined.
- 4c097ef: Sit every run on a line on one baseline
  
  Mixed-size text hung each run off the *line top* at its own ascent instead of
  off a shared baseline, so a 16-unit run beside a 40-unit run floated up level
  with the big run's cap rather than standing on the line with it. Two faces with
  different ascents at the same size diverged the same way. Baseline alignment is
  what inline text does everywhere else, and the module header already claimed
  this behavior — the walk just never implemented it.
  
  A line now sinks one baseline far enough to clear its tallest run's ascent and
  places every glyph against it. Glyph quads derive their top from that baseline
  rather than from the pen's line top, which is the whole of the change:
  `qy0 = baselineY + (yoffset - metrics.base) * scale`.
  
  Uniform-size text — nearly all text — is unchanged, since the maximum over one
  value is that value. Only lines that actually mix sizes or faces move, and they
  move to where they always should have been.
  
  The test named "mixed-size runs share a baseline on the same line" asserted only
  a quad count and passed throughout; it now asserts the baselines.
- d933a89: Superscript, subscript and overline for styled runs
  
  `StyledRun` gains `script: 'super' | 'sub'` — a raised or lowered baseline and
  a smaller size together, the pair `<sup>` and `<sub>` imply. It is a preset
  over two new primitives rather than a mechanism of its own:
  
  - `baselineShift` — raise (positive) or lower (negative) a run off the line's
    shared baseline, in ems of the inherited font size.
  - `fontScale` — a multiplier on the inherited font size, the relative
    counterpart to `fontSize`. An absolute `fontSize` still wins over it.
  
  Naming either directly overrides that half of `script` and leaves the other
  alone. The preset's numbers are exported as `SCRIPT_METRICS` (58.3% size,
  ±33.3% position — Adobe's defaults, so a character panel can show percentages
  its users already recognize) and are derived, not read from the font: `OS/2`
  carries real `ySuperscript*` metrics but the baked atlas tier has no slot for
  them, and metrics that applied on one glyph tier and not the other would
  reflow text as it crossed the size threshold.
  
  `resolveRuns` folds all of it into one world-unit `baselineShift` and a final
  `fontSize`, so layout never learns superscripts exist — it places a run against
  a baseline and an offset. The shift moves a run's glyphs, its outline geometry
  and its own decoration rules together, and deliberately does not feed back into
  the line's baseline or height: a superscript rides the line rather than
  reflowing it.
  
  `overline` joins `underline` and `strikethrough` on both `TextStyle` and
  `StyledRun`, additive over the node style like the other two, and is now
  available to a custom `RunGrammar` as a `RunFlag`. The default markdown grammar
  is unchanged — it stays silent on the decorations, as it always has been.
- Updated dependencies [2621cbf]
- Updated dependencies [9977908]
- Updated dependencies [3386d64]
- Updated dependencies [84db1f6]
- Updated dependencies [94f2446]
  - @weasel-js/geom@1.3.0
  - @weasel-js/font@1.3.0
  - @weasel-js/paint@1.3.0
