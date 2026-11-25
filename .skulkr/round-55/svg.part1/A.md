I couldn't save `.skulk/out/findings.md` because the write was refused both times, so the whole findings document is below.

# Audit round 55 — svg.part1 findings

## `<use>` and `<symbol>` children bypass every filter `readChildren` applies, so a `display="none"` child of a symbol is drawn
- where: packages/svg/src/parse.ts:210 (parseElement, the `use` arm's `draw` callback)
- scenario: `<symbol id="s"><rect width="10" height="10"/><rect display="none" x="20" width="10" height="10"/></symbol><use href="#s"/>`. `parseUse` calls `draw(c, …)` for each symbol child, and the callback goes straight to `parseElement`. That skips `readChildren`'s checks: `display="none"`, `visibility="hidden"`, `systemLanguage`/`requiredExtensions`, foreign-namespace children and the stroke-outline unwrap. The hidden rect is drawn as a visible path (and not marked `hidden` under `keepHidden`). A `<foo:bar>` inside the symbol warns "unsupported element" instead of being skipped. The same applies to a `<use>` whose target is a leaf with `visibility="hidden"`. Should: route symbol children, and the target, through the same filter `readChildren` applies.
- evidence: read (parse.ts:173-187, parse.ts:210, use.ts:58-61)
- severity: medium

## `fitLeafXml` cuts a start tag at the first `>`, which `escapeAttr` leaves unescaped, producing malformed XML
- where: packages/svg/src/groupPaintXml.ts:49 (START_TAG, used by fitLeafXml)
- scenario: a path node with `meta: { inkscape: { attrs: { label: 'a > b' } } }` serialized inside a group that sets `fill`. `escapeAttr` escapes `& " <` but not `>`, so the `<path …>` holds a literal `>`. `/<(path|text)\b([^>]*?)(\/?)>/` ends the match at that `>` and appends the resets (` fill="#000000"` …) inside the attribute value: `inkscape:label="a fill="#000000">  b"/>`. That is not well-formed XML, so the document fails to parse in any reader. Any attribute value containing `>` on a path or text leaf (meta attrs, `font-family`) triggers it whenever `painted` or `inherits` is non-empty. Should: match attribute values quoted (`(?:[^>"]|"[^"]*")*`).
- evidence: read (registry/src/xmlEscape.ts:27-31, serialize.ts:146, serialize.ts:281-285)
- severity: medium

## `<switch>` skips a `<use>` child, drawing the next alternative instead
- where: packages/svg/src/conditional.ts:8 (DRAWN_TAGS)
- scenario: `<switch><use href="#icon"/><text>fallback</text></switch>`. `DRAWN_TAGS` lists leaves, `text`, `image`, `g`, `a`, `svg` and `switch` but not `use`, which `parseElement` draws. `drawnChildren` therefore passes over the `<use>` and returns the `<text>` fallback. SVG renders the `<use>`. Should: include `use` in `DRAWN_TAGS`.
- evidence: read (parse.ts:210)
- severity: low

## `stroke-dashoffset` in `em` is read against 16px, not the element's font size
- where: packages/svg/src/fontSize.ts:44 (LENGTH_PROPERTIES)
- scenario: `<path font-size="40" stroke-dasharray="1em 1em" stroke-dashoffset="0.5em" …/>`. `computeFontRelative` converts `stroke-width`, `stroke-dasharray` and `letter-spacing` to user units but not `stroke-dashoffset`, which `PROPERTIES` also reads as an inherited length. `readStroke` reads it with `styleValue(style, 'stroke-dashoffset')`, which passes no font size, so `readProperty` uses `DEFAULT_FONT_SIZE`. The dash array becomes 40/40 but the offset is 8 instead of 20. An inherited one also resolves against the wrong element's size. Should: add `stroke-dashoffset` to `LENGTH_PROPERTIES`.
- evidence: read (properties.ts:268, readPaint.ts:84, cascade.ts:232-236)
- severity: low

## An axis-aligned `<path>` rectangle traced from any corner but top-left is turned into a `rect`, moving where its dashes and trim start
- where: packages/svg/src/lowerLeaf.ts:105 (polygonToRectIfAxisAligned)
- scenario: `<path d="M10 0 L0 0 L0 10 L10 10 Z" stroke-dasharray="4 2" …/>` (starts top-right and runs counter-clockwise). The check `y0===y1 && x1===x2 && y2===y3 && x3===x0` passes for any start corner and either winding. The path becomes `{ kind: 'rect', x: 0, y: 0, … }`, which `asPolygonPath`/`rectToContour` traces from (x, y) in the fixed direction. The dash pattern, the dash offset and a stroke `trim` now begin at another corner and run the other way, so the stroke is drawn differently from the source. Should: convert only when the start is the min corner and the winding matches `rectToContour`'s.
- evidence: read (geom/src/paths/builder.ts:182-190); the stroke difference is inferred
- severity: low

## A sized marker's def id can collide with another marker's key, and the second marker is drawn with the first's def
- where: packages/svg/src/markerDefs.ts:51 (markerDefOf)
- scenario: markers registered under keys `arrow` and `arrow-s2`, one stroke referencing `{ key: 'arrow', size: 2 }` and another referencing `'arrow-s2'`. Both get the id `arrow-s2` (`${base}-s${size}`, and a SAFE_ID key is its own id). `PaintServerRegistry.markerId` keeps only the first def per id (paintServers.ts:82), so both strokes reference one `<marker>`: one of them shows the wrong head. The same holds for a key ending in `-tip`. Should: make the suffixed ids unable to equal a bare key, e.g. by hashing or escaping whenever a suffix is added.
- evidence: read
- severity: low

## The `currentColor` fallback after a `url()` paint is painted black, not the `color` in effect
- where: packages/svg/src/color.ts:51 (parsePaintAttr), with cascade.ts:219 (resolveCurrentColor)
- scenario: `<g color="red"><rect fill="url(#missing) currentColor" …/></g>`. `resolveCurrentColor` only handles a value that is exactly `currentColor`, so the whole string reaches `parsePaintAttr`. Its recursive call turns the fallback `currentColor` into `#000000`, and `readPaint` (readPaint.ts:38-42) paints that black. SVG paints the fallback red. Should: resolve a `currentColor` fallback against the cascade's `color`.
- evidence: read
- severity: low

## A nested `<svg>` sized in percentages makes the percentage lengths inside it read as bare numbers
- where: packages/svg/src/lengths.ts:27 (viewportOf)
- scenario: `<svg viewBox="0 0 400 100"><svg width="50%" height="50%"><rect width="10%" height="10"/></svg></svg>`. The rect's nearest `<svg>` has percentage sizes and no viewBox, so `viewportOf` returns `undefined` rather than resolving those sizes against the outer viewport (200 × 50). The rect's width gets a "no viewport" warning and is read as 10. SVG gives 10 % of 200 = 20. Should: resolve the nested svg's percentage size against its own nearest viewport.
- evidence: read
- severity: low

## A media override given as `undefined` replaces the default and makes every query on that feature fail
- where: packages/svg/src/media.ts:85 (mediaEnvironmentFor)
- scenario: `parseSvg(s, { media: { prefersColorScheme: settings.scheme } })` with `settings.scheme` unset. `...overrides` copies the explicit `undefined` over `'light'`. Then `(prefers-color-scheme: light)` and `(prefers-color-scheme: dark)` are both false, and a `width: undefined` override makes every width query false. A `Partial<SvgMediaEnvironment>` caller expects that to mean "use the default". Should: skip undefined entries when merging.
- evidence: read
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

<!-- done: 9 findings, files read: 45 -->