## Greek-rung bars of a text node with an inherited fill keep the old container paint
- where: packages/text-tools/src/node/textLadder.ts:28 (paintGreekText)
- scenario: a text node whose `fill` is `inherit` sits in a container; zoom out until its font is 3–6 device px, so the `greek` rung paints. Change the container's fill. `paintGreekText` memoizes through `nodeMemo(node, SLOT, pose, derive)` with no `also` argument, but `derive` reads `inherited?.fill`. The child's `data` and pose are unchanged, so the memo hits and the bars stay in the old color until the child itself is edited. The full rung (`TEXT_PAINTER.paint`) rechecks `held.inherited` for exactly this reason; the greek rung should pass `inherited` as `nodeMemo`'s `also`.
- evidence: read (nodeMemo keys on pose, data and `also` only: packages/core/src/core/scene/nodeMemo.ts:105)
- severity: medium

## Greek-rung bars ignore `verticalAlign`, `fit` and `overflow: 'clip'`, so they sit where the text is not
- where: packages/text-tools/src/node/textLadder.ts:38-49 (paintGreekText)
- scenario: a sticky note (defaults `verticalAlign: 'center'`, `overflow: 'clip'`), zoomed out to the greek rung. The full rung centers the lines vertically in the box and clips them to it. The greek bars always start at `box.y`, so they sit at the top of the note. The loop also keeps bars until `top + em*0.6 > box.y + box.height + pitch`, so a long note draws bars up to a line pitch below its bottom edge, which the clip forbids. A `fit: 'shrink'` node gets bars at its unshrunk size and pitch, taller than the text the full rung draws. Two layouts give two answers for where a node's lines are, and the picture jumps when the zoom crosses `TEXT_FULL_FROM_PX`.
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

<!-- done: 2 findings, files read: 32 -->
