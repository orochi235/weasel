# Audit round 71 — text-tools (blind reviewer)

## Greek rung memo ignores the inherited fill, so bars keep a container's old color
- where: packages/text-tools/src/node/textLadder.ts:28 (paintGreekText)
- scenario: a text node with `fill: INHERIT` inside a container, zoomed out so its font is 3–6 device px (greek rung). Change the container's fill. The node's `data` and pose are unchanged, so `nodeMemo(node, SLOT, pose, …)` (keyed on pose, data and `also`, packages/core/src/core/scene/nodeMemo.ts:105) hits, and the bars keep the old inherited color. The `inherited` the closure captured is not passed as `also`. The full rung's paint (textPainter.ts:113) re-derives when `held.inherited !== inherited`, so the two rungs handle the same input two different ways. The fix is to pass `inherited` as the memo's `also`.
- evidence: read
- severity: medium

## Greek bars ignore verticalAlign (and fit), so centered or bottom text jumps to the top when zoomed out
- where: packages/text-tools/src/node/textLadder.ts:39 (paintGreekText)
- scenario: a sticky note (default `verticalAlign: 'center'`) or any text with `verticalAlign: 'bottom'`. Zoom out until it is in the greek rung (3–6 px). The bars are laid from `box.y` down, so they sit at the top of the box. At 6 px the glyphs draw centered or at the bottom, so the text jumps vertically as the zoom crosses the rung. The greek rung should place its lines where `textPoseOf` lays them out, offsetting the block by the box's slack for `verticalAlign`.
- evidence: read
- severity: low

## Greek rung drops a background's shadow and edge
- where: packages/text-tools/src/node/textLadder.ts:51 (paintGreekText)
- scenario: a sticky note (background, `edge`, `shadow` from STICKY_DEFAULTS) zoomed into the greek rung draws only the background rect and the bars. The `textFrameOf` shadow and edge that `paintText` draws (textPainter.ts:209) disappear, then come back at 6 px. The note's frame is not text, so the ladder's stand-in for small text should not remove it. Meanwhile `drawnBounds` still reports the shadow box.
- evidence: read
- severity: low

## Selection and double-click disagree on where overflowing text is: a visible overflow line picks but won't open for editing
- where: packages/text-tools/src/editor/textHitAt.ts:75 (textHitAt), against packages/text-tools/src/node/textPainter.ts:136 (TEXT_PAINTER.silhouette)
- scenario: a text node with default `overflow: 'visible'` whose lines run below its box. The silhouette is the uncut line boxes, so a click on an overflowing line selects the node. `textHitAt` only accepts points inside the pose box (`textPoseContainsPoint` is a pose-rect test, packages/text/src/hitTest.ts:47). So a double-click on that same visible line does not open the node; it opens whatever text lies under it, or nothing. For `'visible'`, the hit test should accept the line boxes the silhouette answers with.
- evidence: read
- severity: low

## enterTextEdit / isTextNode open a locked node, whose edit is then silently discarded
- where: packages/text-tools/src/actions/enterTextEdit.ts:28 (run); packages/text-tools/src/editor/useSceneTextEdit.ts:295 (isTextNode)
- scenario: a selected text node that is locked (selection set programmatically or from a layers panel), with a text or sticky tool active. A click on it runs `enterTextEdit`. `isTextNode` checks only `read.isText`, so `startEdit` opens the overlay and the user types. On commit, `onChange` (useSceneTextEdit.ts:282) returns early because `scene.isLocked(nid)`, and the typing is lost with no notice. `textAt` (textHitAt.ts:55) and `editEffectText` (editEffectText.ts:19) both refuse locked nodes, so the double-click path and the click path answer "can this be edited" differently. `isTextNode`, or `startEdit`, should reject a locked node the way `textAt` does.
- evidence: read (whether a locked node can be in the selection was not verified)
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
packages/text-tools/src/node/textLadder.ts
packages/text-tools/src/node/textOutline.ts
packages/text-tools/src/node/textPainter.ts
packages/text-tools/src/presets.ts
packages/text-tools/src/testing/openAt.ts
packages/text-tools/src/testing/textPainter.ts
packages/text-tools/src/toolSets.ts
packages/text-tools/src/tools/sticky/stickyNode.ts
packages/text-tools/src/tools/sticky/useStickyTool.ts
packages/text-tools/src/tools/text/useTextTool.ts

<!-- done: 5 findings, files read: 32 -->
