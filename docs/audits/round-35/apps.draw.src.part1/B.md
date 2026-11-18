# Audit round 35 — apps.draw.src.part1

## A text node with empty text shows a blank Layers row instead of falling back to a name
- where: apps/draw/src/LayersPanel.tsx:89 (LayersContent, itemFor)
- scenario: draw a sticky note and end its text edit with no text (kept since fa6767add8, "keep an empty sticky note when its text edit ends", so `data.text === ''`). `data.label ?? data.text ?? effectNodeName(data) ?? node.id` stops at `''` because `??` only skips null/undefined → the row's label is empty, an unclickable-looking blank row with nothing to identify it. Should fall back (to the node id, as every other unnamed node does) when the text is empty.
- evidence: read
- severity: low

## Turning machine-font outlines off leaves the 350- and 950-weight faces registered
- where: apps/draw/src/fonts.ts:128 (disableMachineFontOutlines)
- scenario: `enableMachineFontOutlines` registers each local face at the weight `parseFontStyle` reads (packages/font/src/outline/localFonts.ts:54), which includes 350 (`semilight`/`demilight`) and 950 (`extrablack`/`ultrablack`). `disableMachineFontOutlines` unregisters only weights 100, 200 … 900, so a family with a Semilight or Extra Black face (e.g. a Windows/macOS system family carrying one) keeps that face's outline registration after the user turns outlines off: that weight keeps drawing from the font file while the others return to the SDF tier. The weight set is decided twice; the disable should drop what enable registered (or what the font package reports as registered), not a hand-written grid.
- evidence: read
- severity: low

## Copy loupe color stays enabled and copies a stale hex once the loupe is hidden or its lens unmounts
- where: apps/draw/src/LoupeProvider.tsx:72-87 (LoupeProvider)
- scenario: show the loupe, move over a red area (`color` = `#ff0000`), then hide the loupe (switch, or its own close). `color` is never reset: `setVisible(false)` leaves it, and when `ready` goes false `LoupeLens` unmounts without reporting `null`. The `draw.loupe.copy` action is registered unconditionally and its `enabled` reads only `colorRef`, so from the command palette (or any binding) it stays enabled and copies `#ff0000`, a color no longer under any loupe; re-showing the loupe also shows that old hex in the readout until the pointer moves, though the state's own doc says it is "Null until the pointer has moved over the canvas with the loupe showing". Clearing `color` when the lens hides/unmounts would match the doc.
- evidence: read
- severity: low

## Pathfinder's z-compare rebuilds and scans the whole render order on every comparison
- where: apps/draw/src/booleansAdapter.ts:36-39 (drawBooleansAdapter, compareZ)
- scenario: `compareZ` spreads `scene.renderOrder()` into a fresh array and runs two `indexOf`s over it on each call, and it is a sort comparator, so ordering k operands in an n-node document costs O(k log k · n) time and allocates an n-length array per comparison. A union of 500 selected paths in a 5,000-node drawing is roughly 4,500 comparisons × 15,000 element visits ≈ 70M steps and 4,500 throwaway 5,000-element arrays inside one click, a visible stall. One rank map built per op (or per render-order revision) answers every comparison in O(1).
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
