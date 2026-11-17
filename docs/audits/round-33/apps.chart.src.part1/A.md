# Audit round 33, area apps.chart.src.part1 — blind reviewer findings

## The Sequence panel's "Adds" picker reads any non-actor head as "Participant", so a database/queue/boundary head cannot be set to a plain participant from it
- where: apps/chart/src/SequencePanel.tsx:75 (SequencePanel, participant Select)
- scenario: import a Mermaid sequence with `database DB` (the reader sets `outline: 'cylinder'`; `boundary`, `control`, `entity`, `collections`, `queue` likewise get outlines, `packages/diagram-formats/src/mermaid/sequence/syntax.ts:31`) and select its head. `selectedKey` maps every outline but `'actor'` to `'participant'`, so the picker claims the head is a plain participant. Choosing "Participant" re-chooses the selected key, so the Select fires no change and `setParticipantOutline(..., undefined)` never runs; the head stays a cylinder. The only way to flatten it is the detour Actor → Participant. The picker should show no matching value for an outline it does not list, so that choosing Participant applies.
- Same on the Arrow picker (SequencePanel.tsx:82): for a selected message drawn with an arrow no `SEQ_ARROWS` entry names (e.g. dashed line with an open head, Mermaid `--)`), `arrowNameOf` answers `null` and the picker falls back to `arrowChoice`, the *tool's* option, so it shows e.g. "Call" for a message that is not one, and choosing "Call" does nothing to it.
- evidence: read (SequencePanel.tsx:69,75-86, SequenceEdits.tsx:22 arrowNameOf, author.ts:76 setParticipantOutline, syntax.ts TYPE_OUTLINES); that re-choosing the selected key fires nothing is inference from react-aria's controlled single-select state
- severity: low

## The Sequence pickers and SequenceEdits' Activates/Deactivates show only the first selected item's value, so a mixed selection cannot be set to that value
- where: apps/chart/src/SequencePanel.tsx:67-93 (head/frag/arrow selectedKey); apps/chart/src/SequenceEdits.tsx:41,56-63 (message Activates/Deactivates)
- scenario: select two messages, the first solid-arrowed, the second dashed, and want both solid. The Arrow picker shows the first message's arrow; choosing it re-chooses the selected key, so no change fires and the second message keeps its dashed arrow, though the apply path (`foldEach(d, sel.messages, ...)`) is written to set every selected one. Same for two heads (actor + participant → choose Actor), two fragments of different types, and two messages' Activates/Deactivates. A selection whose members differ should show no single value, so any choice applies to all.
- evidence: read; the no-change-on-same-key behavior is inference from react-aria's Select
- severity: low

## File › Export › As DOT / draw.io is turned off by a page the export would never write, or would leave out with a warning
- where: apps/chart/src/importExport.tsx:68 (FormatExport, `enabled`)
- scenario: a chart whose page 1 is a flowchart and page 2 a sequence (Page › Add Page… → a sequence template). DOT is `onePage: true, kinds: ['graph']` (`packages/diagram-formats/src/dot/format.ts:18`) and `exportChart` hands it only the page in view; with page 1 in view it would write it fine, but `formatFitsKinds(format, scenePageKinds(scene))` asks every page's kind, so "As DOT…" is off. draw.io writes the whole document and, per `DiagramFormat.kinds`' contract (`document.ts`: "a writer of the whole document leaves out a page of any other kind, with a warning", `graphPagesOf`), would export the graph page and warn about the sequence one, which `FormatExport` already reports through `reportFileWarnings`; it is off too. The gate should ask a one-page format about the shown page's kind, and a whole-document one whether it takes any page, leaving the rest to the writer's warnings.
- evidence: read (importExport.tsx:39-47,68; document.ts formatFitsKinds/writtenPage/graphPagesOf; dot/format.ts, drawXml/format.ts)
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

<!-- done: 3 findings, files read: 27 -->
