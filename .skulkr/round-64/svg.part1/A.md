# Audit round 64 — svg.part1 findings

## A comma-separated `@container` query list matches only through its first query
- where: packages/svg/src/container.ts:49 (containerQueryHolds)
- scenario: `@container card (width > 10px), side (width > 10px) { rect { fill: red } }` with the root declaring `container: side / size`. The whole prelude is handed in at once (stylesheet.ts pushes `at[2]` unsplit). The name check reads only the first name, `card`, which the root does not declare, so it returns false and the rule is dropped, though the second query of the list holds. The converse also goes wrong: when the first name matches, the rest of the list goes to `evaluateMediaQuery`, which reads `side (width > 10px)` as a media type `side` plus junk and throws a syntax error that it treats as false. CSS Conditional 5 allows `@container <container-condition>#`, a list that holds when any member does. The list should be split at top-level commas and each member checked for its own name and condition.
- evidence: read
- severity: low

## A leaf that inherits its group's stroke gets back the end markers and stroke that `pathAsSvgDraws` removed from it
- where: packages/svg/src/groupPaintXml.ts:64 (fitLeafXml), with packages/svg/src/openSubpathFill.ts:25 (closedStroke), :110 (withFill), :95 (drawsAsGroup)
- scenario: `<g stroke="#000" marker-end="url(#m)"><path d="M0 0H10V10Z"/></g>` parsed, then serialized. The path is marked `inherits.stroke`. `pathAsSvgDraws` writes the closed path with `closedStroke`, without `marker-end`, because the kit draws no end marker on a closed path. Then `fitLeafXml` sees `inherits.stroke` and strips every stroke attribute from the first `<path>`, and it adds no `marker-end="none"` reset because the attribute is in `dropped`. So the path takes `marker-end` from the `<g>` again, and the exported SVG draws an arrow the canvas does not. The multi-subpath case is worse. With a marked stroke and a fill, `withFill` puts a fill-only piece (no stroke) first in the group `drawsAsGroup` builds. `fitLeafXml` strips that piece's `stroke="none"`/`marker-*="none"` resets, which `groupXml` added for its children, because it is the first `<path>` in the leaf's markup. So the fill piece inherits the group's stroke and markers and draws every marker a second time. The inheriting leaf should keep its resets for whatever the drawn form removed (end markers, and the whole stroke on a fill-only piece), or it should not be treated as inheriting once it is drawn differently from the group.
- evidence: read (serialize.ts:146 applies fitLeafXml to the whole leaf markup; serialize.ts:175/groupXml adds resets per child first)
- severity: medium

## A geometry length in `em` under a `<use>` is read against the target's DOM ancestors, not the `<use>` it inherits from
- where: packages/svg/src/lengths.ts:80 (lengthOf, via styleAt)
- scenario: `<defs><rect id="r" width="2em" height="1em"/></defs><use href="#r" font-size="40"/>`. `parseUse` draws the target with the `<use>`'s style threaded down (`deriveStyle(style, el)`), as SVG has it. But `lengthOf` gets the font size from `styleAt(el)`, which walks the rect's DOM parents (`svg > defs > rect`) and finds 16. So the rect comes out 32×16 where a browser draws 80×40. A `<symbol>`'s children have the same problem. The parse also answers "what is the font size here" two ways: `stroke-width="2em"` on the same rect is computed from the threaded cascade (`computeFontRelative` in deriveStyle) and comes out right, while its `width` does not. lowerLeaf should receive the threaded style (or its font size) rather than re-deriving one from the DOM.
- evidence: read (use.ts:43/58 threads `inner`; lowerLeaf.ts:60-63 → readLength → styleAt)
- severity: low

## `visibility="hidden"` on a `<use>` or a `<text>` drops descendants that turn themselves back on
- where: packages/svg/src/parse.ts:368 (isHiddenElement)
- scenario: `<use href="#g1" visibility="hidden"/>` where `#g1` holds `<rect visibility="visible" …/>`, or `<text visibility="hidden">a<tspan visibility="visible">b</tspan></text>`. `visibility` is inherited, and a descendant can set it back to `visible` (the doc comment says this is why `<g>` is walked). But only `g`/`svg`/`a`/`switch` are exempt, so a `<use>`, which draws its target as a subtree, and a `<text>`, whose tspans are drawn children, are judged as leaves by their own resolved visibility and dropped whole: readChild returns `[]`, or with `keepHidden` marks every node it produced `hidden`. A browser draws the rect and the "b". `use` should be walked like a group, and the text should not be dropped while one of its tspans is visible.
- evidence: read
- severity: low

## A `<tspan x>` that stays on the current line is dropped silently, and splits the text's `x`-list measurement as if it opened a new line
- where: packages/svg/src/glyphShifts.ts:210 (mayOpenLine), :280 (foldTextPositions), :130 (placeRun)
- scenario: `<text x="0 10 20" y="10">ab<tspan x="50" y="10">c</tspan></text>`. `mayOpenLine` says the tspan may open a line because it has `y`. But `LineTracker.startsLine` (tspanLines.ts:121) opens none, since the pen did not leave the baseline. `foldTextPositions` still starts a new segment at `c` and returns `dxs[2]` (0) for it, the rule for "a later line starts at the box edge". So `c`'s own `x="50"` is discarded, and `c` is set right after `b` on the same line, where a browser draws it at x = 50. With no `x` list on the `<text>`, the same tspan (`ab<tspan x="50">c</tspan>`) loses its `x` with no warning at all: `placeRun` only names `x` when `x.length > 1`, and `startsLine` returns 0. The 1-value form is the common one in exported SVG, for example a column jump on one baseline. The gap from the previous glyph should be folded in as spacing (the move from where `b` leaves the pen to x = 50 needs only the advances already measured), or the drop should at least be reported.
- evidence: read
- severity: medium

## `opacity` and `clip-path` on a `<use>` are dropped silently
- where: packages/svg/src/parse.ts:225 (parseElement → parseUse)
- scenario: `<defs><rect id="r" width="10" height="10"/></defs><use href="#r" opacity="0.5" clip-path="url(#c)"/>`. The `use` branch returns `parseUse(...)` before the clip-path handling at :227, and neither path reads `ownValue(el, 'opacity')` for the `<use>`. `parseUse` threads only the inherited cascade (`deriveStyle(style, el)`), which does not carry the non-inherited `opacity` or `clip-path`. The rect comes back fully opaque and unclipped, with no warning. A browser draws it at half opacity, clipped. `<g>` (parseGroup), a nested `<svg>` (opacity) and a leaf (clip) all honor these, so the `<use>` should wrap what it draws in a group with its own `opacity` and `clip` (through its own transform), as parseGroup does.
- evidence: read (use.ts:28-65 reads only href, x, y, transform and the target's display)
- severity: medium

## `stop-color: currentColor` is read as black although the cascade can resolve it
- where: packages/svg/src/gradientStops.ts:27 (readStops)
- scenario: `<linearGradient id="g" color="red"><stop offset="0" stop-color="currentColor"/>…`, or a `color` inherited from the gradient's ancestors. readStops passes the raw `ownProp(c, 'stop-color')` to `readProperty`, which warns and reads it as black (properties.ts:98). Every other paint in the parse resolves `currentColor` against the cascade's `color` through `resolveCurrentColor` (cascade.ts:218), so one question is answered two ways, and a gradient that themes with `currentColor` (a common icon idiom) turns black. readStops should resolve the value against the stop's own cascade (`styleAt(c)`) first.
- evidence: read
- severity: low

## A chain of `<use>` references never counts toward `NESTING_LIMIT`
- where: packages/svg/src/parse.ts:225 (parseElement), with :148 (parseChildren)
- scenario: 20 000 sibling `<use id="uN" href="#uN+1"/>` elements, each referencing the next, the last a `<rect>`. `nesting` only goes up in `parseChildren`, but `parseUse` lowers its target through `readChild` directly (and a `<symbol>`'s children the same way), so use → use → use recurses without counting. Each costs 1 against `USE_ELEMENT_BUDGET` (100 000), so the budget does not stop it either. The walk overflows the stack, and readDocument's RangeError catch turns the whole parse into `SVG nests too deeply to read`, losing every other node in the document. The constant's doc says it covers "`<use>` references included". The fix is to increment and check `nesting` around the `draw` calls in the `use` branch.
- evidence: read (inferred depth; not run)
- severity: low

## Files read
packages/svg/src/__fixtures__/fixtures.ts
packages/svg/src/absoluteUnits.ts
packages/svg/src/alignedTextStroke.ts
packages/svg/src/bakeTransforms.ts
packages/svg/src/bitmapHref.ts
packages/svg/src/booleanGroup.ts
packages/svg/src/cascade.ts
packages/svg/src/color.ts
packages/svg/src/condition.ts
packages/svg/src/conditional.ts
packages/svg/src/container.ts
packages/svg/src/cssScan.ts
packages/svg/src/draftPose.ts
packages/svg/src/draftSpecs.ts
packages/svg/src/draftTakes.ts
packages/svg/src/elements.ts
packages/svg/src/fadePaint.ts
packages/svg/src/fillPaint.ts
packages/svg/src/fontSize.ts
packages/svg/src/framedText.ts
packages/svg/src/fromKit.ts
packages/svg/src/glyphRises.ts
packages/svg/src/glyphShifts.ts
packages/svg/src/glyphTurns.ts
packages/svg/src/gradientStops.ts
packages/svg/src/gradients.ts
packages/svg/src/groupBox.ts
packages/svg/src/groupPaint.ts
packages/svg/src/groupPaintXml.ts
packages/svg/src/hugeStrokeBounds.bench.ts
packages/svg/src/index.ts
packages/svg/src/kitInherits.ts
packages/svg/src/kitPaint.ts
packages/svg/src/laidLines.ts
packages/svg/src/lengths.ts
packages/svg/src/lowerLeaf.ts
packages/svg/src/markerDefs.ts
packages/svg/src/media.ts
packages/svg/src/metaXml.ts
packages/svg/src/metricScale.ts
packages/svg/src/openSubpathFill.ts
packages/svg/src/paintServers.ts
packages/svg/src/paintThroughMatrix.ts
packages/svg/src/painterLeaf.ts
packages/svg/src/parse.ts

<!-- done: 8 findings, files read: 45 -->
