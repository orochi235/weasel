# @weasel-js/text

## 1.4.0

### Patch Changes

- Updated dependencies [a7fa697]
  - @weasel-js/geom@1.4.0
  - @weasel-js/font@1.4.0
  - @weasel-js/paint@1.4.0

## 1.4.0-pre.1

### Patch Changes

- @weasel-js/font@1.4.0-pre.1
  - @weasel-js/geom@1.4.0-pre.1
  - @weasel-js/paint@1.4.0-pre.1

## 1.4.0-pre.0

### Patch Changes

- Updated dependencies [a7fa697]
  - @weasel-js/geom@1.4.0-pre.0
  - @weasel-js/font@1.4.0-pre.0
  - @weasel-js/paint@1.4.0-pre.0

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

## 2.0.0-pre.0

### Patch Changes

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
    _wrapped_ line was never affected: the wrap leaves it as a trailing cell on
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

  Mixed-size text hung each run off the _line top_ at its own ascent instead of
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

- Updated dependencies [3386d64]
- Updated dependencies [84db1f6]
- Updated dependencies [94f2446]
  - @weasel-js/geom@2.0.0-pre.0
  - @weasel-js/paint@2.0.0-pre.0
  - @weasel-js/font@2.0.0-pre.0
