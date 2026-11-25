# Audit round 79 — apps.draw.src.part1

## Loupe toggle and copy actions are frozen objects whose `active`/`enabled` change with no registry notice
- where: apps/draw/src/LoupeProvider.tsx:113 (LoupeProvider, `copy` and `toggle` memos)
- scenario: both actions are memoized on `useLatest` refs, which never change identity, so the action objects are registered once and never replaced. `toggle.active` reads `visibleRef.current` and `copy.enabled` reads `colorRef.current`. Press F2 → the loupe shows, but nothing re-registers or notifies the registry, so a menu row or command button drawn from the registry for `draw.loupe.toggle` can keep its old checked state, and one for `draw.loupe.copy` its old enabled state, until something unrelated re-renders it. Only the schema asset, which gates on `enableIf: { path: 'color' }` through `useLoupeBinding`, stays in step. The fix is to put `visible`/`color` in the memo deps, or to have a watch fire when they change.
- evidence: read (inference about registry consumers, not run)
- severity: low

## The theme's UI font is taken as its first stack entry, unparsed, and enrolled as a canvas font
- where: apps/draw/src/LoupeProvider.tsx:166 (useThemeUiFont)
- scenario: `stack.split(',')[0]` assumes the resolved value is a plain family list. If a theme's `--wzl-font-ui` is a `var(--x, Oswald, …)` expression (applyTheme.test.ts:119 shows the theme writes these), or begins with a generic other than `sans-serif` (`system-ui`, `ui-sans-serif`), the family comes out as `var(--x` or a generic keyword. `registerCanvasFont` then enrolls it, and the HUD sets its text in a family the canvas cannot resolve. Only the literal `sans-serif` is excluded.
- evidence: read (whether `resolved` can still hold `var()` is inferred from the test, not run)
- severity: low

## HMR re-evaluation of main.tsx re-registers exports and fonts and reopens the session, dropping the disposers
- where: apps/draw/src/main.tsx:63 (module body: `registerDrawExports()`, `registerAvailableFonts()`, `openSession()`)
- scenario: the file already handles HMR re-runs for the React root (`__reactRoot ??=`), but the module-level side effects run again on every re-evaluation. `registerDrawExports()` returns a disposer that is thrown away. `registerCanvasFont` adds another hold per family on each run. `openSession()` opens the session records again, and nothing releases the earlier one. In a dev session these registrations pile up with each edit to main.tsx.
- evidence: read
- severity: low

## Export Page's filename embeds the user's page name unsanitized
- where: apps/draw/src/exportPage.ts:51 (exportPagesFile)
- scenario: a page renamed `Q3/Q4: draft` is exported as `untitled - Q3/Q4: draft.png`. `downloadBlob` passes that name to the `download` attribute. Browsers replace or strip `/` and `:` in their own ways, so the saved name differs from the one shown, and from one browser to the next. `baseName` cleans only the `.svg` suffix.
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
