# Audit round 80 — apps.draw.src.part1

## Font holds registered at startup are never released, so each HMR re-evaluation of main.tsx stacks another hold per family
- where: apps/draw/src/fonts.ts:96 (registerAvailableFonts), called from apps/draw/src/main.tsx:58
- scenario: `registerCanvasFont` returns a disposer that removes its hold (packages/font/src/dynamic/dynamicAtlas.ts:118). `registerAvailableFonts` drops it. main.tsx is written to survive HMR re-evaluation (the `__reactRoot` stash), and each re-evaluation runs `registerAvailableFonts()` again, adding one more hold object per installed family to `canvasHolds`. Nothing ever removes them, so the set grows by one per family per hot reload and a family can never be unregistered. `registerDrawExports()`'s disposer at main.tsx:61 is dropped the same way. It should keep the disposers and release them on `import.meta.hot.dispose`, or register only once.
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

<!-- done: 1 findings, files read: 38 -->
