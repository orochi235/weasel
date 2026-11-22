# Audit round 67 — svg.part1 findings

## A `'world'`-units gradient or pattern on a leaf whose pose has a `transform` is moved by that transform on export
- where: packages/svg/src/fromKit.ts:157 (leafOnOutline)
- scenario: a path/shape leaf with `fill: { paint: { kind: 'linear-gradient', units: 'world', from, to, … } }` and a pose carrying `transform: [1, 0.5, 0, 1]` (or any non-identity linear). `paintToLocalUnits` passes a world paint through unchanged, then `paintThroughMatrix(node.fill, frame)` → `fillThroughMatrix`, which maps `'world'` as well as `'local'` through the pose frame. The geometry is baked into world coordinates by `pathThroughPoseFrame`, so the world gradient ends up skewed/moved relative to where the canvas draws it. The renderer resolves `'world'` against the view matrix only (`packages/renderer/src/draw/gradient.ts:169`, `gradientSpaceInverse`), never the node's paint frame, and `painterLeaf.ts`'s `paintIn` (same package) explicitly treats a world paint as already in the document's frame. Should: map only `'local'` paints through `frame` and leave `'world'` (and screen) paints alone. Same for the stroke paint via `strokeThroughMatrix` on line 158. The rotation-only branch (line 159) has the mirror problem: it leaves a world paint as is and sets `node.rotation`, which `serialize.ts` `rotationAttr` writes as `transform="rotate(…)"` on the element, so a `userSpaceOnUse` world gradient turns with the shape where the canvas keeps it fixed (inferred from serialize.ts:294-313; not run).
- evidence: read (fromKit.ts 152-159, paintThroughMatrix.ts 30-31, renderer paintToLocalUnits.ts 23-31, gradient.ts 167-170, painterLeaf.ts 109-120)
- severity: medium

## A one-value `dx` is thrown away whenever the text has collapsible white space, though `dy` and `rotate` keep theirs
- where: packages/svg/src/glyphShifts.ts:130-136 (placeRun), and packages/svg/src/glyphShifts.ts:315 (TextShifts constructor)
- scenario: pretty-printed `<text x="0" y="20" dx="10">\n    Label\n  </text>`, or `<text>Hello<tspan dx="4"> world</tspan></text>`. `placeRun` counts `dx` as named as soon as any value is nonzero, then `collapses(el, run.text)` is true (newline / leading space), so the whole list is dropped with "is not read" and the text is drawn 10 (or 4) units left of where SVG draws it. Collapsing white space can only move glyphs *after* the first, so a list with only a first value is never affected by it. The sibling readers draw that line: `movesOf` (glyphRises.ts:22-23) refuses only when `y.length > 1` or a later `dy` is nonzero, and `turnsOf` (glyphTurns.ts:22) only when values differ. Should: apply the collapse refusal to `dx` only when a value past the first is nonzero (and likewise in `TextShifts`, line 315), reading `dx[0]` always.
- evidence: read
- severity: medium

## A percentage length under a root `<svg>` with no `viewBox` and no absolute size has "no viewport", while media and container queries size that same root 300 × 150
- where: packages/svg/src/lengths.ts:22-45 (viewportOf / viewportSide)
- scenario: `<svg xmlns=…><rect width="50%" height="50%"/></svg>`, or `<svg width="400"><rect width="50%"/></svg>` (height absent). For the root, `viewportSide` reads an absent side as `100%` of `viewportOf(root)`, which has no parent and returns `undefined`, so the side is NaN and the whole viewport is `undefined`: every percentage, even on the known width axis, is read as the bare number (50) with a warning. `mediaEnvironmentFor` (media.ts:69-88) answers the same question for the same root as width/height from attributes, else viewBox, else the 300 × 150 replaced-element default, and `@container` queries (cascade.ts `containersHold`) size the root by it. One decision, two answers: a rect is 50 wide while a `(width > 100px)` rule matches as if the root were 300 wide. Should: resolve a root's missing side through the same environment (or at least use the side that is known).
- evidence: read
- severity: low

## `raiseRuns` misplaces rises when the first run it reaches holds earlier glyphs; `turnRuns` handles the same case
- where: packages/svg/src/glyphRises.ts:91-93 (raiseRuns)
- scenario: the loop walks back from the end of `line` until it has covered `rises.length` glyphs; when the earliest run it reaches holds more glyphs than are needed (n goes negative), `g` still starts at 0, so `rises[0]` lands on the first glyph of that run — a glyph before the ones being raised — and every rise after it is shifted by the overshoot, with the last raised glyphs reading `rises[g] ?? 0`. `turnRuns` (glyphTurns.ts:62) answers the identical walk with `let g = Math.min(n, 0)` so the earlier glyphs keep their own value. One decision, two answers; `raiseRuns` should start `g` at `Math.min(n, 0)` and leave glyphs with `g < 0` at their own shift.
- evidence: read (both functions); whether a caller currently produces a straddling run is inferred from turnRuns' explicit handling, not reproduced
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

<!-- done: 4 findings, files read: 45 -->
