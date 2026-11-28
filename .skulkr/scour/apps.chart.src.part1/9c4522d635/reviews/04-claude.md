# Findings: apps.chart.src.part1

No defects found. Leads traced and cleared:

- `SequenceEdits` Add/Remove section on a mixed selection: `addSection` and `removeSection` (packages/diagram/src/sequence/authorSteps.ts) leave a fragment unchanged when it can't take the edit.
- `ChartPageStrip` onAdd `getOwn(PAGE_TEMPLATES, diagramTypeOf(scene).id)!`: `PAGE_TEMPLATES` holds a graph template for every `DIAGRAM_TYPES` id.
- `exportChart` passes `page` to multi-page writers too: only one-page writers read `opts.page`.
- Theme and doc values after New or Import: `addDocumentScene` replaces the doc with `drawn.doc`, and that doc carries the theme key (toScene.ts:89).
- `chartThemeOf` and `diagramTypeDocOf` are read during render: `useScene` in `Modes` subscribes to the scene version, so `ChartWorkspace` re-renders on every edit.
- `viewport={{ recenter }}`: SceneCanvas keys off `viewport?.recenter`, which is memoized.
- The inline options passed to `useSceneTextEdit`: the hook reads them through `useLatest` refs.
- `Delete Page` `enabled` returns `pages.removable`, typed `true | ActionDisabledReason`.
- `reportFileWarnings` does nothing when there are no warnings.

## Files read
apps/chart/src/App.tsx
apps/chart/src/ChartWorkspace.tsx
apps/chart/src/NewChartDialog.tsx
apps/chart/src/PlotDataSection.tsx
apps/chart/src/SequenceEdits.tsx
apps/chart/src/SequencePanel.tsx
apps/chart/src/StencilPanel.tsx
apps/chart/src/app.css
apps/chart/src/autoLayout.ts
apps/chart/src/chartCommands.ts
apps/chart/src/chartDocument.ts
apps/chart/src/chartPersistence.ts
apps/chart/src/exportCommands.ts
apps/chart/src/icons.gen.ts
apps/chart/src/icons.table.ts
apps/chart/src/importExport.tsx
apps/chart/src/main.tsx
apps/chart/src/menuBar.ts
apps/chart/src/modes.ts
apps/chart/src/page.css
apps/chart/src/pages/AddPageDialog.tsx
apps/chart/src/pages/ChartPageStrip.tsx
apps/chart/src/pages/PageSetupDialog.tsx
apps/chart/src/pages/pageCommands.ts
apps/chart/src/pages/pageSizes.ts
apps/chart/src/pages/useChartPages.ts
apps/chart/src/pages/useFittedView.ts
apps/chart/src/prefs.ts

<!-- done: 0 findings, files read: 28 -->
