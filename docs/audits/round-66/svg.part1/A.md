# Audit round 66, area svg.part1

## A path with closed and open subpaths, a fill, and no stroke is written as a group holding an invisible extra `<path>`
- where: packages/svg/src/openSubpathFill.ts:59 (strokeParts), :80-90 (pathAsSvgDraws)
- scenario: an `SvgPathNode` whose polygon path has one closed and one open subpath, `fill` solid, no `openFill: 'close'` (so `filled === closed`), and `stroke` undefined. `strokeParts` still splits into `[closed, open]` with `stroke: undefined` on both, `withFill` puts the fill on the closed part, and `pathAsSvgDraws` returns a `<g>` of two paths, the second `fill="none"` with no stroke, which draws nothing. Parsing the result back yields a group of two paths in place of the one path node, and the node's `meta`/`opacity` move to that group. The split exists only so a stroke can be written for the open part; with no stroke the closed part alone, as one `<path>`, is what SVG should get.
- evidence: read
- severity: low

## `revert` and `revert-layer` on an inherited property are kept as a literal value, not rolled back
- where: packages/svg/src/cascade.ts:180-184 (keepsParent), :199-208 (deriveStyle), :152-155 (cascaded's take)
- scenario: `<g fill="red"><rect style="fill: revert" …/></g>`. `isDeclarationInvalid` accepts `revert` as a CSS-wide keyword (`CSS_WIDE_KEYWORDS` in properties.ts holds `revert` and `revert-layer`), so the cascade keeps it as the rect's own `fill`. `keepsParent` knows only `inherit` and `unset`, so `deriveStyle` writes `next.fill = 'revert'`, which no paint reader parses, and the rect falls back to the reader's default instead of red. In the author origin, `revert` on an inherited property means inheriting the parent's value (there is no user-agent rule for SVG paint), and `revert-layer` should drop to the next-lower layer's value or the presentation attribute. It is answered two ways: valid to the validity check, unknown to every reader.
- evidence: read
- severity: medium

## `svgStrokeFromKit` silently drops a stroke's `varyingWidthJoinThreshold` and `vertexColors`
- where: packages/svg/src/kitPaint.ts:31-53 (svgStrokeFromKit)
- scenario: a kit path leaf whose stroke has `vertexWidths` and `varyingWidthJoinThreshold: 3`, exported through `svgNodesFromKit` → `serializeSvg` and read back. The copy lists every other `Stroke` field but not this one, and nothing in `packages/svg/src` writes or reads it (grep finds no match), so the re-imported stroke uses the default 1.5 and the joins between segments whose widths differ by 1.5× to 3× turn from miter to bevel. A stroke's `vertexColors` (per-anchor RGBA) is dropped the same way with no warning, while `painterLeaf.ts:76` warns when a painter's command carries vertex colors. So one kit feature gets two answers, warned on one path and silent on the other.
- evidence: read
- severity: low

## A nested `<svg width="auto">` leaves its children with no viewport for percentages
- where: packages/svg/src/lengths.ts:38-44 (viewportSide)
- scenario: `<svg viewBox="0 0 200 100"><svg width="auto" height="50"><rect width="50%" …/></svg></svg>`. SVG 2 gives `auto` on an `<svg>`'s `width`/`height` the same meaning as `100%`. `LENGTH` does not match `auto`, so `viewportSide` goes to `resolveLength`, whose `parseFloat('auto')` is `NaN`. The fallback is `NaN` too, so `viewportOf` returns `undefined`, and the rect warns "has no viewport to be a percentage of" and is read as 50 user units instead of 100. Only an absent attribute is treated as `100%`.
- evidence: read
- severity: low

## A `container` shorthand declared after `container-type` does not reset it
- where: packages/svg/src/container.ts:29-32 (queryContainerOf)
- scenario: the root `<svg style="container-type: size; container: card">`. CSS resets `container-type` to `normal` when the later shorthand omits the type, so the root is not a size container and every `@container card (…)` rule fails. Here the longhand wins whatever the order, so the root is a `size` container named `card` and those rules apply. The cascaded map `cascaded()` hands it has no declaration order, so the reader cannot tell which came last; the doc comment states the longhand-wins rule, but that is not what CSS does.
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
packages/svg/src/hiddenElement.ts
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

<!-- done: 5 findings, files read: 45 -->
