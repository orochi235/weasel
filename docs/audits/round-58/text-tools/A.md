# Audit round 58 — text-tools (reviewer findings)

## The canvas's own editor stands down for a host editor of a different scene, and the dep then falls to the no-op stub
- where: packages/text-tools/src/editor/canvasEditor.tsx:65 (useDefaultTextEditor `yields`) vs :70 (`host`); hostTextEditors.ts:45 (`hostTextEditorHolds`) vs :51 (`hostTextEditDep`)
- scenario: a host mounts `useSceneTextEdit(sceneA, container)` where `container` also holds a `<SceneCanvas>` of scene B (a second document, a preview, a minimap with text). `yields()` asks `hostTextEditorHolds(el)`, which ignores the scene, so canvas B's own editor stands down; `host()` asks `hostTextEditDep(el, sceneB)`, which matches on scene and returns null; `DefaultTextEditDep` then returns `below()`, the stub. A double-click or text tool on canvas B calls the stub's `startEdit`, which only warns — no editor opens anywhere. Should: either both checks match on scene (canvas B keeps its own editor), or neither.
- evidence: read
- severity: medium

## editEffectText places the caret by the default `data.text` shape, not the editor's `getText`, and reads stored rather than shown data
- where: packages/text-tools/src/actions/editEffectText.ts:21-22 (textUnder)
- scenario: a host editor with a custom `getText` (data shaped `{ label: { body } }`): a click on the text-on-path effect opens the source with `caret: 0`, since `isTextData(data)` is false, while the double-click path (`textHitAt`, effect branch, textHitAt.ts:61) opens the same source with the caret at `read.text(...).length`. Two ways into the same edit answer the caret differently; the doc ("opens its text" at its end) holds only for default-shaped data. Also reads `scene.get` (stored) where textHitAt reads `shown.get` (draft), so the length is pre-draft during an open edit.
- evidence: read
- severity: low

## enterTextEdit swallows the sticky tool's click on a selected non-text node (or a multi-selection) instead of passing it on
- where: packages/text-tools/src/actions/enterTextEdit.ts:19-31 (invoker.run); bound by packages/text-tools/src/tools/sticky/useStickyTool.ts:79
- scenario: sticky tool active, a rectangle (or two nodes) selected, click on the selected rectangle. The `sticky.editText` binding (`target: 'selected-body'`) outranks the untargeted `sticky.click` → `place`. `run` sees `isTextNode(id) === false` (or `sel.length !== 1`) and returns `undefined`, and the action has no `enabled`, so the dispatcher treats the click as handled: no note is placed. The same click on an unselected rectangle places one. Should: return `'pass'` (or decline in `enabled`) when there is nothing to open, so the dispatcher walks on to `place` (docs/taxonomy.md "Hand-off").
- evidence: read
- severity: medium

## A sticky `background` or `fill` with no `paint` is replaced by the default yellow paper / default ink
- where: packages/text-tools/src/tools/sticky/useStickyTool.ts:47-51 (createStickyTool `color`), packages/text-tools/src/tools/sticky/stickyNode.ts:65,73 (stickyData)
- scenario: `createStickyTool({ background: {} })` — a `Fill` with `paint` omitted, which `Fill` documents as "paints nothing". `color(background?.paint)` is `undefined`, so `withToolOptionDefault` keeps `STICKY_DEFAULTS.background.paint`; the `paper` option then always arrives defined and `optionFill(look.paper, …)` paints the note `#fff1a6`. Should: an explicitly paint-less background (or fill) give a note with no paper (or no ink), as `null` on the option already does.
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

<!-- done: 4 findings, files read: 31 -->
