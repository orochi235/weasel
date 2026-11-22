# Audit round 67 — svg.part1 findings

## A walk started below the top marks an `'inherit'` paint as carried by a group that is never written, so the serializer drops it
- where: packages/svg/src/fromKit.ts:329 (svgNodesFromKit → lower, `markInherits`) and :349 (`groupPaintFromKit`); packages/svg/src/kitInherits.ts:52 (markInherits), :29 (groupPaintFromKit)
- scenario: `svgNodesFromKit(tree, { roots: ['m'] })` where `m` is a mark with `fill: 'inherit'` under a group `g` with a solid red fill (the case `fromKit.test.ts:290-303` sets up). `emit` seeds `up` from `paintAbove(chain)`, so `up.fill` is red and `markInherits` sets `m.inherits = { fill: true }`, while `g` itself is not emitted. `serializeSvg` then runs `fitLeafXml` on the top-level leaf (serialize.ts:147), which drops every fill attribute of a paint the node `inherits`. With no `<g fill>` above it, the path is drawn in SVG's initial black, not red. A root group with `fill: 'inherit'` goes wrong the same way through `groupPaintFromKit`: its `<g>` leaves its fill out, and so do the children that inherit from it. The existing test checks only `m.fill`, never the serialized output. What should happen: a node emitted at the top of the walk is never marked as inheriting, because nothing written above it carries the paint, so its resolved paint is written on it.
- evidence: read
- severity: medium

## A built-in leaf's `'world'` (and `'screen'`) gradient or pattern turns and skews with the node's pose, though the canvas holds it still in scene space
- where: packages/svg/src/fromKit.ts:144-160 (leafOnOutline): `paintThroughMatrix(node.fill, frame)` and `strokeThroughMatrix(stroke, frame)` in the linear-frame branch, and `node.rotation = pose.rotation` in the rotation-only branch; the same holds for text through svgTextFromKit (:174-190), which writes `rotation`/`transform` onto the element
- scenario: a `kit:path` rect with `fill: { paint: { kind: 'linear-gradient', units: 'world', from: {x:0,y:0}, to: {x:100,y:0}, … } }` and `pose.rotation = π/3`. The canvas resolves `'world'` against the view matrix alone (renderer/src/draw/gradient.ts:169), so the ramp stays horizontal in scene space while the rect turns through it. `svgLeafFromKit` writes the rect with `transform="rotate(60 …)"` and the gradient as `userSpaceOnUse` in that rotated space, so the SVG ramp turns 60° with the rect. With a skewing `pose.transform`, `fillThroughMatrix` maps the world gradient's points through the pose frame, which moves it the same wrong way. `painterLeaf.ts:109-120` (`paintIn`) makes the opposite call for a painter of the app's own: it takes a `'world'` or `'screen'` paint back through the inverse of the frame "so its tile lands where the canvas paints it" (painterLeaf.test.ts:79-105). So the same paint exports two ways depending on which painter draws the node. What should happen: a built-in leaf takes a `'world'`/`'screen'` paint back through the inverse of the frame it is written under (or leaves it unmapped once the geometry is baked), as `paintIn` does.
- evidence: read
- severity: medium

## The root `<svg>`'s size is read two ways: as the viewport for percentages and as the media environment for `@media` / `@container`
- where: packages/svg/src/media.ts:55 (absoluteLength, mediaEnvironmentFor) vs packages/svg/src/lengths.ts:38 (viewportSide)
- scenario: `<svg width="10em" height="5em">` with no viewBox, and a child `<rect width="50%">` plus `@media (min-width: 200px) { rect { fill: red } }`. `viewportSide` converts `10em` with the font size and resolves the rect's 50% against a 160 × 80 viewport. `absoluteLength` accepts only absolute units, so `mediaEnvironmentFor` throws the size away and uses the 300 × 150 default. The media query therefore matches a viewport that is 160 wide, and `@container` queries on the root are answered at 300 × 150. What should happen: both readers agree on one root viewport size.
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

<!-- done: 3 findings, files read: 45 -->
