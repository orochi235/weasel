# Findings: apps.chart.src.part1

No defects found. Candidates traced and cleared:

- SequenceEdits Add/Remove section across mixed fragments: `addSection` skips non-multi-section types and `removeSection` keeps a fragment's only section (packages/diagram/src/sequence/authorSteps.ts:204-218).
- SequencePanel participant picker: `SeqParticipantKind` is only `participant | actor`, matching `headKind` and `setParticipantOutline`.
- `arrowNameOf` agrees with `setMessageArrow` on `both` / `async`.
- ChartPageStrip add button: `getOwn(PAGE_TEMPLATES, diagramTypeOf(scene).id)!` always hits, since every `DIAGRAM_TYPES` entry has a graph template under its id and `diagramTypeOf` falls back to flowchart.
- New/Import keep the theme: `documentSpecs` writes `DIAGRAM_THEME_KEY` into the doc that `addDocumentScene` replaces.
- Export warnings with an empty list: `reportFileWarnings` returns early.
- PageSetupDialog's paper sizes and orientation handling (`resized`, `turned`, `setupOf`) check out for listed, custom and square sizes.

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
