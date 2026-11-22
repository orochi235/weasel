# Audit round 69 — p-touch

## A carried line's pen reach is ignored by the clip test, so a stroked line passes `insideClips` while its ink leaves the clip
- where: packages/p-touch/src/lbx/writeLbx.ts:95 (insideClips)
- scenario: an `lbxObjectsCommand([{ type: 'line', points: [{x:0,y:10},{x:50,y:10}], pen: { style: 'SOLID', widthX: 6 } … }])` inside a group clipped to the rect `x 0..50, y 7..13`. The line's `position` is `{x:0, y:10, width:50, height:0}`, which lies inside the clip, so the object is written whole. P-touch draws a 6pt pen, reaching y 7..13 and, with a round arrow, x −3..53: ink past the clip, where the canvas (and the rasterized siblings, which `placed` clips) stop at the clip edge. The same file already measures a line's ink with `inkSpanX` for `withinLength` (line 114), so the reach a line's stroke adds is answered one way for the length check and another for the clip check. It should test the stroke's reach (`inkSpanX` and its y counterpart), or skip such a carrier with a reason.
- evidence: read
- severity: medium

## `textObject` ignores a run's `lang`, so language-specific forms are lost without the box being rasterized
- where: packages/p-touch/src/lbx/shapes.ts:156 (textObject)
- scenario: a text box whose runs carry `lang: 'sr'` (Serbian Cyrillic italics) or `lang: 'ja'` vs `'zh'` (CJK glyph variants). The mapper compares family, size, weight, style, rules, stroke, overline, sizeMap, rotate, letterSpacing, baselineShift, fontFeatures and strutSize, but never `run.lang`, and the `TextObject` it writes has no language. The canvas shapes the run with the language's forms; P-touch draws the face's defaults. Every other run attribute the `.lbx` object cannot carry sends the command to the rasterizer; `lang` is the one silently dropped (and runs differing only in `lang` also pass the per-run uniformity check).
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

<!-- done: 2 findings, files read: 10 -->
