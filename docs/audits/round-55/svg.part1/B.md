# Findings: svg.part1 (round 55)

## A `currentColor` fallback after a `url(#id)` paint is read as black, not the cascade's `color`
- where: packages/svg/src/color.ts:51 (parsePaintAttr)
- scenario: `<g color="red"><rect fill="url(#missing) currentColor"/></g>`. `resolveCurrentColor` (readPaint.ts:16) only rewrites a value that is wholly `currentColor`, so the string reaches `parsePaintAttr` intact; the recursive call on the rest (`currentColor`) hits line 40 and returns `#000000`. The unresolved reference falls back to black where SVG paints red.
- evidence: read (color.ts:40–53, readPaint.ts:16,34–40)
- severity: low

## A pattern fill is not taken through the matrix its element's geometry is baked with
- where: packages/svg/src/paintThroughMatrix.ts:31 (fillThroughMatrix)
- scenario: `<g transform="translate(100 0) scale(4)"><rect width="10" height="10" fill="url(#p)"/></g>` with `<pattern id="p">` a weasel tile or a single-`<image>` pattern. `parseLeaf` bakes the rect into world space and passes the fill through `paintThroughMatrix(…, baked)`; `fillThroughMatrix` returns any paint whose `units` is not `'world'`/`'local'` unchanged, and `readPlacement` (patterns.ts:141) never sets `units`. The tile keeps its user-space `origin` and `transform`, so it is drawn at a quarter of its size and 100 units off from where SVG draws it on the moved, scaled rect. Gradients get the mapping; patterns are the one paint-server kind the same table hands out that is skipped.
- evidence: read (paintThroughMatrix.ts:30–48, patterns.ts:141–150, parse.ts:94,298)
- severity: medium

## `<switch>` passes over a `<use>` child, though the parser draws `<use>`
- where: packages/svg/src/conditional.ts:8 (DRAWN_TAGS, used by drawnChildren)
- scenario: `<switch><use href="#logo"/><text>fallback</text></switch>`. `drawnChildren` takes the first child whose tag is in `DRAWN_TAGS`; `use` is not in it, so the `<text>` fallback is drawn instead of the referenced shape, and `<switch><use href="#logo"/></switch>` draws nothing. `parseElement` (parse.ts:210) handles `use`, so the switch and the walk answer "can this parser draw it" two different ways.
- evidence: read (conditional.ts:8,41–44, parse.ts:210)
- severity: medium

## A nested `<svg>`'s `opacity` (and SVG 2 `transform`) is dropped without a warning
- where: packages/svg/src/parse.ts:224 (parseElement, nested-`<svg>` branch)
- scenario: `<svg x="10" opacity="0.5"><rect …/></svg>` inside the root. The branch returns the bare `parseChildren` array, offset by `x`/`y`; unlike `parseGroup` it never reads `ownValue(el, 'opacity')` or `transform`, so the children are drawn fully opaque (and unmoved by a `transform="…"`), and the only warning it can give is about `viewBox`. A `<g>` with the same attributes keeps both.
- evidence: read (parse.ts:224–233 vs 325–341)
- severity: low

## A framed text node's shadow and edge are refitted onto its box on export, losing the shadow's offset and blur and the edge's inset
- where: packages/svg/src/fromKit.ts:120 and :123 (svgLeafFromKit, text-with-background branch)
- scenario: a `kit:text` node with `background`, `shadow: { x: 4, y: 4, blur: 6, alpha: 0.5 }` and `edge: { width: 2, … }`. `textFrameOf` returns the shadow as rects offset by (4, 4) and grown/shrunk per blur layer, and the edge as a rect inset by `w / 2`, all already in world coordinates; the canvas draws them as they are (textPainter.ts:195,198). `svgLeafFromKit` instead passes each through `svgLeafFromKit({ path, … }, pose)`, whose `pathInPoseBox(data.path, pose)` (line 128) rebases the path's bounds onto the pose box. Every shadow layer becomes exactly the text box, hidden under the background (no offset, no falloff), and the edge's stroke is centered on the box edge instead of inset, so half of it falls outside the box (and is cut away when the node clips).
- evidence: read (fromKit.ts:117–125,128; geom pathInWorld.ts:36–52; text-tools textFrame.ts:54–70; renderer dropShadow.ts:39–54)
- severity: high

## A percentage under a nested `<svg>` without `width`/`height` finds no viewport
- where: packages/svg/src/lengths.ts:27 (viewportOf)
- scenario: `<svg viewBox="0 0 200 100"><svg x="10"><rect width="50%" height="10"/></svg></svg>`. The nested `<svg>` has no `viewBox` and no `width`/`height`, which SVG reads as `100%` of the parent viewport (200 × 100). `viewportOf` stops at the first `<svg>` ancestor and returns `undefined` when either attribute is absent, so `lengthOf` warns "has no viewport to be a percentage of" and reads the rect as 50 wide instead of 100. A `%` `width`/`height` on that nested `<svg>` fails the same way rather than resolving against the ancestor.
- evidence: read (lengths.ts:20–34,76–84)
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

<!-- done: 6 findings, files read: 45 -->
