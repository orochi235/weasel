# Findings: apps.chart.src.part1

## File › Open throws on a saved chart holding a locked node with children
- where: apps/chart/src/chartPersistence.ts:75 (replaceChart)
- scenario: open a `.weaselchart.json` whose snapshot has a node with `locked: true` and a child under it (a locked container or group, e.g. saved by another weasel app or edited by hand). `replaceChart` lifts the lock guard only around `removeMany`; the `scene.add(spec)` loop runs guarded, so adding the child calls `refuse(parent, 'add under')` (packages/core/src/core/scene/treeEdits.ts:96) on the just-added locked parent and throws "Scene: cannot add under …". The batch fails and Open reports "Could not open the file" for a valid file. It should load the file as saved, with the lock last (as `docs/unruled.md`'s 2026-11-10 duplicate ruling does), e.g. by running the whole replacement inside `scene.unlocked`.
- evidence: read
- severity: low
- fix: apps/chart/src/chartPersistence.ts
- size: line
- cause: lock guard lifted for removal only, not for restoring the saved nodes
- confidence: likely

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

<!-- done: 1 findings, files read: 28 -->
