# Audit round 66 — svg.part1 findings

## `svgNodesFromKit` with `roots` below the top drops the paint a root inherits, though it rebuilds the root's frame from its ancestors
- where: packages/svg/src/fromKit.ts:362 (svgNodesFromKit, root loop)
- scenario: a scene group `G` with `fill: red` holds a mark `M` with `fill: 'inherit'`. `svgNodesFromKit(scene, { roots: ['M'] })` (exporting a selection) calls `emit('M', NO_UP_PAINT, frameAbove('M'))`: `frameAbove` walks `M`'s ancestors so the pose lands where the canvas draws it, but the inherited paint is the empty `NO_UP_PAINT`, so `resolvedData` turns `'inherit'` into `null` and `M` is written `fill="none"`. The canvas (core `inheritedPaintOf`, walking ancestors until one does not say `'inherit'`) paints it red. The walk should seed the root's `up` from its ancestors the same way it seeds its frame.
- evidence: read (fromKit.ts:288-306, 362-364; core/src/core/scene/inheritedPaint.ts:35-61)
- severity: medium

## A marker key can mint the same `<defs>` id as a gradient, pattern, clip or text cut
- where: packages/svg/src/markerDefs.ts:73 (idOfKey); packages/svg/src/paintServers.ts:39, 91 (register, clipId); packages/svg/src/alignedTextStroke.ts:87 (cutId)
- scenario: a marker registered under key `grad0` (or `clip0`, `pat1`, `textcut0`) — `idOfKey` keeps any key with no unsafe character and no `--` as the id itself. In a document that also has its first gradient, `toDefsXml` writes `<linearGradient id="grad0">` and `<marker id="grad0">`; `url(#grad0)` on both the fill and the `marker-end` resolves to whichever comes first (the gradient), so the marker vanishes (or a fill points at a marker). The derived-id scheme only protects against other marker keys, not against the registry's own `grad`/`pat`/`clip`/`textcut` counters.
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

<!-- done: 2 findings, files read: 45 -->
