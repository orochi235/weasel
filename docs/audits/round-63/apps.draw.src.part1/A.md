# Audit round 63 — apps.draw.src.part1

## A Boolean result made from a sticky note keeps the note's frame data, including its 48×48 `minSize`
- where: apps/draw/src/drawDocument.ts:75 (`CONTENT_KEYS` / `carriedData`), used by apps/draw/src/booleansAdapter.ts:58 (`drawBooleansAdapter.createPathNode`)
- scenario: Draw a sticky note (its data carries `background`, `padding`, `overflow`, `edge`, `shadow`, and `minSize: {48, 48}` from `stickyData`), select it with a path, and run Pathfinder ▸ Intersect. The text operand comes from `getOutline` (`outlineAt`), so the result piece's source is the note, and `createPathNode` copies `carriedData(note.data)` into the new path node. `CONTENT_KEYS` drops only content and paint, so the path keeps every `TextFrameData` key. Because `minSizeOf` is read for any node by resize (`packages/editing/src/actions/resize/minimum.ts`), the path cannot be resized below 48×48 even if the glyph piece is 5 px wide. Its `background`, `padding`, `overflow`, `edge` and `shadow` stay on a path node that has no note frame to apply them to. What should happen: a path made from a note keeps only what a path can use (its `label`, say). `TextFrameData`'s keys, `minSize` among them, should be left out of `carriedData`, the same way content is.
- evidence: read (stickyNode.ts:52/72 writes minSize; minimum.ts:20 reads `minSizeOf(scene.get(id).data)` for any node; operands.ts:73 takes text outlines; commit.ts:33 passes the text node's id as `sourceId`)
- severity: medium

## `setBackground` treats only `#ffffff` as the default white, but the Background field always writes `#rrggbbaa`
- where: apps/draw/src/docBackground.ts:16 (`setBackground`)
- scenario: The Properties panel's Background leaf is `pref.color(..., { alpha: true })`, fed through `backgroundHex` (sidebarPanels.tsx:94), so every value it hands back is 8-digit. Pick white (or nudge the picker and return to white): `setBackgroundColor('#ffffffff')` → `setBackground` compares it with `DEFAULT_BG_COLOR` (`'#ffffff'`), finds no match, and stores `draw:background = '#ffffffff'` in `scene.doc`. The doc key is supposed to mean "absent is white" (docBackground.ts:5). Instead the document now carries an explicit background, saved with the session and written as an undo entry that changes nothing visible. `svgExport.ts:33` (`WHITE = /^#?fff(fff)?(ff)?$/i`) answers "is this white?" differently, so the two disagree on what the default is. What should happen: `setBackground` should normalize the color, or use the same white test, before deciding to clear the key.
- evidence: read
- severity: low

## The CommandBar story registers a hand-picked subset of draw's app actions, so its bar differs from the app's
- where: apps/draw/src/CommandBar.stories.tsx:55 (`Actions`)
- scenario: The story says it registers "the kit actions and the app's own itself, the way `<SceneCanvas>` does in the app". In fact it registers only `toggleGridAction`, `toggleSnapAction`, `toggleSymmetryAction` and `releaseCompoundAction`, not `appActions` (actions.tsx:154). So the story's `view` run has no Snapping, Show rulers or Bound view to content buttons, and its `app` run has no Commands (`app.commands`, ⌘K) button, while `commands` (story line 35) implements every field those actions read. A reviewer checking the bar's layout in Forge sees a shorter row than the app draws, and the list goes on drifting as actions are added. What should happen: register `appActions` through the same `appCommandsContribution` the app uses, or loop over `appActions`.
- evidence: read
- severity: low

## The swatch's None toggle and Swap change only the next shape's paint, while its paint editor also paints the selection
- where: apps/draw/src/ActiveSwatches.tsx:41 (`onToggleNone`), :45 (`onSwap`)
- scenario: Select a filled rectangle. Open the fill chip's paint editor and pick red: `onInput`/`onChange` call `colors.setFill` and also run `setFill` on the selection, so the rectangle turns red (one undo entry). Now click the fill chip's None control, or the swap arrow: `colors.toggleNone('fill')` / `colors.swap` (ColorContextProvider.tsx:154–166) rewrite only the shared tool option, and no `setFill`/`setStroke` edit runs. The chip shows none (or the swapped pair) while the selected rectangle stays red with its old stroke. So one widget gives two answers to "does a swatch change paint the selection?". The `/` and `X` keys (colorContext/actions.ts) follow the no-selection path too. What should happen: None and Swap should go through the same `edits.fill`/`edits.stroke` commit as the editor, or the editor should not paint the selection either.
- evidence: read
- severity: low

## Files read
apps/draw/src/ActiveSwatches.tsx
apps/draw/src/App.tsx
apps/draw/src/CommandBar.stories.tsx
apps/draw/src/CommandBar.tsx
apps/draw/src/Editor.tsx
apps/draw/src/EditorStatusBar.tsx
apps/draw/src/LayersPanel.tsx
apps/draw/src/LoupeProvider.tsx
apps/draw/src/RightSidebar.tsx
apps/draw/src/Toolbar.tsx
apps/draw/src/Workspace.tsx
apps/draw/src/adapterPublishers.tsx
apps/draw/src/app.css
apps/draw/src/appCommands/actions.tsx
apps/draw/src/appCommands/depSchemaAugmentation.ts
apps/draw/src/appCommands/index.ts
apps/draw/src/booleansAdapter.ts
apps/draw/src/colorMode.tsx
apps/draw/src/constraintKeys.ts
apps/draw/src/docBackground.ts
apps/draw/src/docPersistence.ts
apps/draw/src/documentUnits.ts
apps/draw/src/drawDocument.ts
apps/draw/src/drawFeatures.ts
apps/draw/src/drawPrefsDialog.tsx
apps/draw/src/exportPage.ts
apps/draw/src/fileCommands.ts
apps/draw/src/fileNotices.ts
apps/draw/src/firstRunNotice.ts
apps/draw/src/fonts.ts
apps/draw/src/icons.gen.ts
apps/draw/src/icons.table.ts
apps/draw/src/loupePrefs.ts
apps/draw/src/main.tsx
apps/draw/src/menuBar.ts
apps/draw/src/menus.ts
apps/draw/src/newShapePaint.ts
apps/draw/src/nodeKinds.ts

<!-- done: 4 findings, files read: 38 -->
