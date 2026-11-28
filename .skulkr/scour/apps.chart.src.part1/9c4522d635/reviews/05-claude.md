# Findings: apps.chart.src.part1

No defects found that survived tracing. Checked and cleared along the way:

- `SequenceEdits` Add/Remove section applied to every selected fragment: `addSection` skips a single-section type and
  `removeSection` keeps a fragment's only section (packages/diagram/src/sequence/authorSteps.ts:204-218).
- `ChartPageStrip` add button's `getOwn(PAGE_TEMPLATES, diagramTypeOf(scene).id)!`: `PAGE_TEMPLATES` holds a graph
  template under every `DIAGRAM_TYPES` id (packages/diagram-formats/src/templates/catalog.ts:51).
- `NewChart` / Import replacing doc values: `documentSpecs` writes the theme and diagram type into `drawn.doc`, which
  `addDocumentScene` replaces wholesale (packages/diagram-formats/src/toScene.ts:85-92, 148-161).
- `exportChart`'s `doc.pages.indexOf(written)`: `writtenPage` returns an element of `doc.pages` or throws, which
  `FormatExport` catches.
- `useSessionPersistence` given a fresh options object each render: it reads them through `useLatest`.
- `pageCommands` Delete's `enabled` returns `pages.removable(id)`, which is `true | ActionDisabledReason`.

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
