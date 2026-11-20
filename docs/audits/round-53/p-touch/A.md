## A text node that doesn't wrap is written with `autoLF` on, so P-touch wraps lines the canvas draws as one
- where: packages/p-touch/src/lbx/shapes.ts:135 (textObject)
- scenario: a text pose keeps the default `wrap: false`. `textPoseLayoutInput` (text/src/layout/textPoseLayout.ts:50) gives it `maxWidth: Infinity` with `alignWidth: pose.width`, and `textCommandFromPose` puts both on the command. `textObject` uses `boxWidth = cmd.width`, which is finite, so the object passes `finiteObject` and is written. It then sets `autoLF: cmd.maxWidth !== undefined`, which is `true` for `Infinity`. Every default text node therefore reaches P-touch with auto line feed on, and a line longer than its box gets broken there while the canvas draws it on one line. It should be `cmd.maxWidth !== undefined && Number.isFinite(cmd.maxWidth)`. The `textBox` arbitrary in pbt.fixture.ts:79 leaves `maxWidth` out instead of setting it to `Infinity`, so the property tests never produce the real command.
- evidence: read
- severity: medium

## RTL text under the default `direction: 'auto'`, or `style.direction: 'rtl'`, gets `start`/`end` mapped as if it were LTR
- where: packages/p-touch/src/lbx/shapes.ts:112,127,136 (textObject)
- scenario: the guard only rejects `cmd.direction === 'rtl'`. `textCommandFromRuns` and `textCommandFromPose` set `direction` from the resolved style, and that defaults to `'auto'` (the first strong character of each paragraph). Take a Hebrew or Arabic label with `align: 'start'`: the canvas aligns it right, but `H_ALIGN.start` writes `horizontalAlignment: 'LEFT'`. `'end'` is flipped the same way. The fix is to resolve `auto` from the text, or to send the box to the rasterizer when the direction is not known to be `ltr` and the align is `start` or `end`.
- evidence: read
- severity: low

## A run's `fontFeatures` (small caps drawn with the face's `smcp`) is dropped without notice
- where: packages/p-touch/src/lbx/shapes.ts:115-124 (textObject)
- scenario: a run with `fontVariantCaps: 'small-caps'` on a face that has `smcp` resolves to `fontFeatures: ['smcp']` with no `sizeMap` (text/src/runs/resolveRuns.ts:85). The canvas draws small caps. `textObject` checks `sizeMap` but never `fontFeatures` or `lang`, so it writes a plain text object, and P-touch shows ordinary lowercase. Runs whose features differ also get merged into one object. The box should go to the rasterizer when any run has `fontFeatures`, or when the runs disagree on it.
- evidence: read
- severity: low

## A polyline's `join` and `miterLimit` are ignored when it becomes a `draw:poly`
- where: packages/p-touch/src/lbx/shapes.ts:65-90 (lineObject)
- scenario: take a 3-point stroked polyline with `join: 'round'` or `'bevel'`, or a miter join that hits its `miterLimit`. `plainStroke` accepts all of these. `lineObject` maps only `cap` to arrows and writes a SOLID pen, so P-touch draws its own join and the corners don't match the canvas. `rectObject` does reject a non-miter join (line 23), so the two mappers answer the same question differently. Lines with more than two points should be rasterized unless the join is one P-touch reproduces.
- evidence: read
- severity: low

## A rect stroke with `miterLimit` below √2 is written with square corners, but the canvas bevels them
- where: packages/p-touch/src/lbx/shapes.ts:23 (rectObject)
- scenario: a stroked rect with `join: 'miter', miterLimit: 1` passes, because `miterLimit` is one of the allowed `PLAIN_STROKE_KEYS` and the join is miter. A rect corner's miter ratio is √2, which is over the limit, so the renderer draws a bevel. The file gets a RECTANGLE with an INSIDEFRAME pen and sharp corners. It should reject `miterLimit < Math.SQRT2`.
- evidence: read
- severity: low

## `cap: 'square'` and `cap: 'butt'` both map to the same `SQUARE` arrow, so a square cap loses its overhang
- where: packages/p-touch/src/lbx/shapes.ts:62 (ARROW_FOR_CAP)
- scenario: a square cap reaches width/2 past each endpoint and a butt cap does not. Both are written as `arrowBegin/arrowEnd: 'SQUARE'`, and the end points are unchanged. At most one of the two caps can match P-touch's output, so a square-capped line comes out width/2 short at each end, or a butt-capped one width/2 long. Either extend the points for a square cap or rasterize it.
- evidence: read (P-touch's exact `SQUARE` geometry wasn't checked)
- severity: low

## `renderLabel` with `background: undefined` loses its white default
- where: packages/p-touch/src/render.ts:66 (renderLabel)
- scenario: `{ background: '#ffffff', ...rest, ... }` lets an explicit `background: undefined` in `rest` replace the default. A caller that writes `renderLabel({ ...geom, scene, background: opts.background })` gets a transparent image, not the white one the doc promises ("on white unless `background` says otherwise"). It should be `background: rest.background ?? '#ffffff'`. `printLabel` hides this because `toGray` composites over white, but any other consumer of the RGBA sees transparency.
- evidence: read
- severity: low

## Files read
packages/p-touch/src/index.ts
packages/p-touch/src/lbx/carried.ts
packages/p-touch/src/lbx/sceneLbx.ts
packages/p-touch/src/lbx/shapes.ts
packages/p-touch/src/lbx/style.ts
packages/p-touch/src/lbx/writeLbx.ts
packages/p-touch/src/pbt.fixture.ts
packages/p-touch/src/print.ts
packages/p-touch/src/render.ts
packages/p-touch/src/tape.ts

<!-- done: 7 findings, files read: 10 -->