## uiFontFamily keeps CSS escapes in a quoted family, so the HUD registers a family name no font has
- where: apps/draw/src/LoupeProvider.tsx:175 (uiFontFamily)
- scenario: the theme's `--wzl-font-ui` is `"Foo\"s Sans", sans-serif` or `'O\'Neil Grotesk', sans-serif`. `firstListEntry` skips the escaped quote correctly, but `uiFontFamily` strips only the outer quotes and returns `Foo\"s Sans` with the backslash still in it. `registerCanvasFont` then enrolls that literal string, which matches no installed face, so the HUD's text falls back instead of using the theme's face. It should unescape (`\X` → `X`) before returning.
- evidence: read
- severity: low

## effectNodeName looks the kind up in the whole settings schema, where drawKindLabel first checks it against EFFECT_KINDS
- where: apps/draw/src/nodeKinds.ts:37 (effectNodeName), compare :29 (drawKindLabel)
- scenario: `PATH_EFFECT_SETTINGS_SCHEMA.children` holds a hidden count leaf per kind (`COUNT[kind]`, packages/path-tools/src/pathEffects/settingsForm.ts:46) beside each kind's section. A saved or pasted document whose `pathEffect.kind` is a kind this build does not know but matches one of those count keys gets that hidden leaf's name as its Layers row name, where the comment on `effectName` promises `undefined`. `drawKindLabel` guards the same lookup with `EFFECT_KINDS`. The same question gets two answers, and only one of them is guarded.
- evidence: read (whether `pathEffectOf` passes an unknown kind through is inferred, not checked)
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

<!-- done: 2 findings, files read: 38 -->
