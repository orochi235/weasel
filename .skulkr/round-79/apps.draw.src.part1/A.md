## Export Selection drops the PNG scale for a format that declares no `options`, where Export Page passes it
- where: apps/draw/src/exportPage.ts:62 (exportSelectionFile) vs apps/draw/src/exportPage.ts:33 (writeExport)
- scenario: A format registered with `options` undefined. `writeExport` reads `!reads || reads.includes(key)`, so undefined means "reads every key" and `scale: PNG_SCALE` goes in. `exportSelectionFile` reads `reads?.includes('scale')`, so undefined means "reads none" and the region gets no scale. The same question gets two answers, and the region-level and option-level scale disagree for that format. Every built-in format declares `options`, so this only affects a third-party format.
- evidence: read
- severity: low

## The loupe binding writes any value to `loupe.mode` unchecked
- where: apps/draw/src/LoupeProvider.tsx:176 (useLoupeBinding onChange)
- scenario: `factor` is guarded with `typeof value === 'number'`, but `mode` is cast with `value as LoupeMode` and stored. A surface control that reports a value other than `'vector'`/`'pixel'` (for example an empty or deselected toggle sending `undefined` or `''`) saves an invalid mode to prefs, and the lens then gets a mode it does not know. It should be checked against the enum's options, the way `factor` is checked.
- evidence: read
- severity: low

## `RegistryEnumControl` shows the string "undefined" for a pref with no value
- where: apps/draw/src/drawPrefsDialog.tsx:51 (RegistryEnumControl)
- scenario: `value={String(ctx.value)}`. When the value is absent (an unset `registry-enum` pref, or a stored value that failed to parse), the select gets the key `"undefined"`. Nothing matches it, and that string can be written back. It should fall back to the pref's default or `''`.
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

<!-- done: 3 findings, files read: 38 -->
