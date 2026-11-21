# Audit round 65 — apps.chart.src.part1

## Switching to pipeline mode and back rebuilds the chart from localStorage, so a chart whose session save failed is lost
- where: apps/chart/src/App.tsx:36 (Modes), apps/chart/src/ChartWorkspace.tsx:68 (ChartWorkspace)
- scenario: `Modes` keeps the pipeline doc mounted above both workspaces (`usePipelineDoc()` in `Modes`, so its undo history and look survive a visit to chart mode, which App.test asserts), but renders `<ChartWorkspace />` only in chart mode. ChartWorkspace owns its scene (`useScene` seeded by `useState(loadChartSession)`), so Mode › Pipeline unmounts it and Mode › Chart builds a new scene from whatever `CHART_SCENE_KEY` holds. When the last autosave did not land (localStorage quota exceeded on a large imported chart; `reportChartSave` toasts the failure but nothing keeps the scene), coming back to chart mode shows the last chart that did save, or `emptyChart()` — the edits are gone, and so is everything else in the workspace: view, selection, the Sequence panel's tool option values (`toolOptionValues`), the open Theme panel. The two modes answer "does a mode switch keep my document" two different ways; chart's scene should be held above the mode switch as the pipeline doc is.
- evidence: read
- severity: medium

## Add section / Remove section act on the first selected fragment only, while every other sequence edit applies to all selected
- where: apps/chart/src/SequenceEdits.tsx:49,74-85 (SequenceEdits)
- scenario: select two `alt` fragments in one sequence. The Fragment picker (`SequencePanel`, foldEach over `sel.fragments`), Activates/Deactivates (foldEach over `sel.messages`), Box participants and Remove box all apply to every selected item, and `shownOf` documents "choosing any value applies it to every item". Add section and Remove section read only `sel.fragments[0]`: the second fragment gets no section, and the buttons' disabled state reflects only the first (a first `opt` with a second `alt` disables Add section for both). Should fold over `sel.fragments` like the rest, enabled when any selected fragment qualifies.
- evidence: read
- severity: low

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

<!-- done: 2 findings, files read: 27 -->
