## The Data panel keeps one chart's error note and open rows when the selection moves to another chart
- where: apps/chart/src/PlotDataSection.tsx:14 (PlotDataSection)
- scenario: select plot A, make an edit its schema rejects (PlotDataPanel shows the thrown message as a note via its `error` state), or open a nested table on row 2; then select plot B. `PlotDataPanel` is rendered at the same position with no `key={rootId}`, so React keeps its `useState` error and `useRowIds`' ids/open state: B's panel shows A's error message, and row 2 of B's table is held open because ids are kept "by position" for a change from elsewhere. Should start fresh per chart (key the panel by `rootId`).
- evidence: read (PlotDataSection.tsx:14; packages/ui-canvas/src/components/PlotDataPanel/PlotDataPanel.tsx:24-33; rowIds.ts:28-34)
- severity: low

## The Sequence panel's Adds and Arrow pickers show the tool's value, not the selection's, when the selected head or message has a figure or arrow the picker doesn't name
- where: apps/chart/src/SequencePanel.tsx:75 and :82 (SequencePanel)
- scenario: a selected participant with `outline: 'cylinder'` (or 'hexagon', both valid `Outline`s a sequence holds, e.g. from Mermaid import) shows "Participant" in Adds, since `head.outline === 'actor' ? 'actor' : 'participant'`; a selected message whose arrow matches no `SEQ_ARROWS` entry (`arrowNameOf` → null) shows the Message tool's current arrow (`arrow ?? arrowChoice`). The picker then misreports the selection, and choosing the value it already displays fires no change, so that value cannot be applied to the selection without first picking another. Choosing "Participant" (when reachable) also silently drops the cylinder/hexagon figure via `setParticipantOutline(..., undefined)`. Should show no/indeterminate value for an unnamed figure or arrow.
- evidence: read
- severity: low

## The page tabs' add button adds a blank page, not "a page of the chart's own type" as ChartPageStrip says
- where: apps/chart/src/pages/ChartPageStrip.tsx:34 (ChartPageStrip, `onAdd`)
- scenario: in a chart whose type is, e.g., a sequence or a graph type with stencil groups, click the tabs' "+" — `pages.add()` with no `make` runs usePages' default, `addPage(scene, { id, ...size })`: an empty page with no template content and no stencil groups joined (contrast `addChartPage`, which goes through `addTemplatePage` and `addStencilGroup`). The component's doc promises the add button adds "a page of the chart's own type"; one of the two is wrong.
- evidence: read (packages/editor/src/usePages.ts:151-163)
- severity: low

## Page Setup's target id is never cleared when its page goes away, so the dialog reopens if the page comes back
- where: apps/chart/src/pages/ChartPageStrip.tsx:14-21,40-44 (ChartPageStrip)
- scenario: open Page Setup on page 2 (`setupFor = 'page-2'`), then page 2 disappears (Undo of the Add page, or a delete reached while the dialog is up): `setupPage` is undefined so the dialog renders nothing, but `setupFor` stays 'page-2' because only `onClose` resets it. A later Redo/Undo that restores page 2 pops Page Setup back open with nothing having asked for it. Should reset `setupFor` when the page is not among `pages.placed`.
- evidence: read
- severity: low

Note: this checkout's HEAD is 4c701b3803, not the brief's d4226fab0e; line numbers above are against the tree as checked out (the diff between the two for apps/chart/src could not be run here).

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

<!-- done: 4 findings, files read: 27 -->
