# Audit round 58 — text-tools findings

Note: the brief names frozen commit b400d7039e, which this checkout does not contain (`git cat-file` fails); the
tree read is HEAD a22801b42b plus its uncommitted edits (`packages/text-tools/src/node/textItems.ts` among them).

## The canvas's own editor stands down for a host editor of a different scene, leaving the canvas with no editor
- where: packages/text-tools/src/editor/canvasEditor.tsx:65 (useDefaultTextEditor `yields`), packages/text-tools/src/editor/hostTextEditors.ts:45 (hostTextEditorHolds)
- scenario: an app calls `useSceneTextEdit(sceneA, appRoot)` and also renders a `<SceneCanvas scene={sceneB}>` (with `textTools.text`) somewhere inside `appRoot`. For canvas B, `yields()` asks `hostTextEditorHolds(el)`, which matches any registered container holding the element regardless of scene → true. `DefaultTextEditDep` then asks `host()` → `hostTextEditDep(el, sceneB)`, which does filter on scene → null, so the dep falls to `below()`, the stub, whose `startEdit` only warns. Double-clicking text or using the text/sticky tool on canvas B opens nothing. The same question ("does a host editor own this canvas?") is answered with the scene in one place and without it in the other; `yields` should ask `hostTextEditDep(el, scene) !== null`.
- evidence: read
- severity: medium

## The properties panel's "Text" field writes `data.text` alone, so on a node with runs the edit never shows
- where: packages/text-tools/src/node/properties.ts:49 (CONTENT, `'data.text'` leaf)
- scenario: a text node has `runs` (any range styled in the overlay, e.g. one word made bold, writes them). In a `SelectionPanel` the user types a new string into Content › Text. The leaf is a plain `kind: 'string'` at `data.text` with no write that touches `runs`, so the node ends up with `text: 'new'` and `runs` still spelling the old string. `textPoseLayoutInput` lays out `pose.runs` whenever it is non-empty (packages/text/src/layout/textPoseLayout.ts:47), so the canvas keeps drawing the old text while the panel shows the new; the overlay opens on the old runs too (`getRuns`), and `createTextLayer` would throw on the broken `runsToPlainText(runs) === text` invariant. The write should drop or re-split the runs (or the leaf should edit through them).
- evidence: read
- severity: medium

## A rotated clipped text node's outline keeps glyphs past its box when they fall inside the box's axis-aligned bounds
- where: packages/text-tools/src/node/textOutline.ts:24 (clippedOutline `cut`), called from packages/text-tools/src/node/textPainter.ts:158 (TEXT_PAINTER.outline)
- scenario: a `kit:text` node with `overflow: 'clip'` and a rotated pose frame (say a 100×20 box at 45°) holds text running past its right edge. `outline` builds the clip as the box through the pose frame (a rotated rect in world space) and passes `boundsOfPath(clip)`, its axis-aligned bounds, as `box`. `cut` skips the `pathIntersect` whenever a glyph path's bounds lie inside that AABB, which for a rotated box includes the triangles outside the box at each corner. Overflowing glyphs landing there are returned whole, so "convert to outlines", booleans and anything else reading the outline get ink the canvas clips away. The shortcut is only sound when the frame keeps the box axis-aligned.
- evidence: read
- severity: medium

## `kit:text`'s `drawnBounds` and `ink` read only the node's stroke, so a stroke set on a run is left out of its reach
- where: packages/text-tools/src/node/textPainter.ts:141 (TEXT_PAINTER.ink), packages/text-tools/src/node/textPainter.ts:145 (TEXT_PAINTER.drawnBounds)
- scenario: a text node with no `data.stroke` and one run carrying `stroke: { paint, width: 8 }` (a word outlined through the overlay's character controls), its first glyph at the box's left edge. The painter draws that run's stroke (`textCommandFromPose` → `runsInPoseFrame` keeps `r.stroke`), reaching 4 units past the box. `drawnBounds` computes `resolveStroke(d.stroke, …)` → null, so `lines` is null and the node claims only its pose box; `ink` likewise reports no stroke reach. Culling, dirty regions and pick tolerance then cut or miss the run's stroke ink. `textOutlineOf` in the same package answers the same question including runs (`hasStroke(stroke) || runs?.some((r) => hasStroke(r.stroke))`, textOutline.ts:15), so the two disagree.
- evidence: read
- severity: low

## A `fit: 'shrink'` text node keeps the size it was fitted at before its face loaded
- where: packages/text-tools/src/node/textPainter.ts:109 (TEXT_PAINTER.paint, the PAINT_SLOT / SCREEN_PAINT_SLOT memos)
- scenario: a text node with `fit: 'shrink'` is painted before its font family's face has loaded (first frame of a page, or a family registered later). `paintText` → `textCommandFromPose` → `textPoseLayoutInput` runs `shrinkScale`, which measures with whatever metrics are available and bakes the factor into the command's run sizes (`scaleRuns`). The result is memoized under `nodeMemo(node, PAINT_SLOT, pose, …, inherited)`, keyed only on data, pose, inherited paint and the nodeMemo generation; a face load moves `faceGeneration()` (which `shrinkScale`'s own cache keys on, packages/text/src/layout/textFit.ts:119) but nothing bumps the nodeMemo generation for it. So once the face lands, the canvas keeps drawing the text at the fallback face's fit, too large (spilling or clipped) or too small, until the node's data or pose changes. The memo's comment ("pure style merging — no font reads — so `(data, pose)` is the whole key") predates `fit`; the painter already declares `geometryGeneration: faceGeneration() + textEngineGeneration()` for its geometry but the paint memo ignores it.
- evidence: read
- severity: medium

## A double-click on text drawn past its box does not open it, though a click there selects it
- where: packages/text-tools/src/editor/textHitAt.ts:75 (textHitAt, the `textPoseContainsPoint` box test)
- scenario: a `kit:text` node with the default `overflow` (`'visible'`) and `wrap: false` holds a line longer than its box, so glyphs are drawn to the right of the pose. TEXT_PAINTER's `silhouette` is the unclipped line boxes (textPainter.ts:134 cuts them only for `'clip'`), so a click on those glyphs picks and selects the node. A double-click on the same glyphs runs `enterTextEditAt` → `textAt` → `textHitAt`, which accepts the point only inside the pose rect (`textPoseContainsPoint(p, { ...pose, ...box })` is a plain rect test), so it answers null and nothing opens — or, because a non-text hit is passed through, it opens a different text node lying under the overflow. The node's hit area is answered two ways: line boxes for picking, pose box for text edit.
- evidence: read
- severity: low

## The canvas's own editor hides the edited node's glyphs in every canvas of the scene sharing its offset parent
- where: packages/text-tools/src/editor/canvasEditor.tsx:100 (useEditingStandIn, `registerPaintStandIn(scene, within, withoutText)` with `within = editor.container`)
- scenario: two `<SceneCanvas>`es of one scene sit in the same positioned wrapper (a main view and a second view or minimap absolutely placed over a corner), each with `textTools.text`. Double-click text in canvas A: A's editor opens its overlay over A and shows its stand-in, registered `within` A's offset parent. `paintStandInsOver(el, scene)` (core paintStandIns.ts:51) applies a stand-in to any canvas of the scene whose element that `within` contains, so canvas B also stops drawing the node's glyphs, while the overlay covers only A. B shows the node with its text missing for the whole edit, although `sceneTextDrafts` exists so that "a second view" shows the draft. The canvas's own editor stands in for one canvas, so its stand-in should be registered within that canvas's element (`editor.element`), not the shared container.
- evidence: read
- severity: low

## `useStickyTool({ background: {} })` (a note with no paper) still makes yellow notes
- where: packages/text-tools/src/tools/sticky/useStickyTool.ts:47 (createStickyTool `color`), packages/text-tools/src/tools/sticky/stickyNode.ts:65 (stickyData)
- scenario: `Fill` with no `paint` "paints nothing" (paint.ts:155), and `StickyStyle.background` is typed `Fill`, so `{}` is how a caller asks for a note without paper (likewise `fill: {}` for no ink). `color(background?.paint)` sees `undefined` and leaves the `paper` option's default at STICKY_DEFAULTS' yellow; the tool option value then reaches the insert as `paper`, and `stickyData`'s `optionFill(look.paper, look.background ?? …)` prefers it, so `look.background` (which the bindings' params never carry anyway) is never read. Every note gets `#fff1a6` paper. Only a `background` with a `paint` takes effect.
- evidence: read
- severity: low

## Files read
packages/text-tools/src/actionParamSchema.ts
packages/text-tools/src/actions/editEffectText.ts
packages/text-tools/src/actions/enterTextEdit.ts
packages/text-tools/src/actions/enterTextEditAt.ts
packages/text-tools/src/editor/canvasEditor.tsx
packages/text-tools/src/editor/editingDrawOne.ts
packages/text-tools/src/editor/hostTextEditors.ts
packages/text-tools/src/editor/sceneTextDrafts.ts
packages/text-tools/src/editor/textEditDep.ts
packages/text-tools/src/editor/textEditScreenPose.ts
packages/text-tools/src/editor/textEditStub.ts
packages/text-tools/src/editor/textHitAt.ts
packages/text-tools/src/editor/textLayer.ts
packages/text-tools/src/editor/useSceneTextEdit.ts
packages/text-tools/src/featurePresets.ts
packages/text-tools/src/icons.gen.ts
packages/text-tools/src/index.ts
packages/text-tools/src/ingest/textHandler.ts
packages/text-tools/src/node/insert.ts
packages/text-tools/src/node/properties.ts
packages/text-tools/src/node/textFrame.ts
packages/text-tools/src/node/textItems.ts
packages/text-tools/src/node/textOutline.ts
packages/text-tools/src/node/textPainter.ts
packages/text-tools/src/presets.ts
packages/text-tools/src/testing/openAt.ts
packages/text-tools/src/testing/textPainter.ts
packages/text-tools/src/toolSets.ts
packages/text-tools/src/tools/sticky/stickyNode.ts
packages/text-tools/src/tools/sticky/useStickyTool.ts
packages/text-tools/src/tools/text/useTextTool.ts

<!-- done: 8 findings, files read: 31 -->
