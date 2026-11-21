## Page Setup's Orientation field does not follow a custom width/height edit, so the dialog can apply a size its fields contradict
- where: apps/chart/src/pages/PageSetupDialog.tsx:39-42 (SetupDialog, Width/Height onChange)
- scenario: open Page Setup on a Letter-landscape page, choose Size "Custom" (orientation stays Landscape, 1056×816), then type Width 500 (now 500×816, taller than wide). The Orientation select still reads "Landscape" while the size is portrait; picking "Landscape" again is the current value, so it fires no change and does not turn the page. Apply writes a portrait page under a dialog saying Landscape, and reopening shows Portrait (`setupOf` derives it from the size). The width/height setters should recompute `orientation` from the new size, as `setupOf` does, so the field and the size can't disagree.
- evidence: read
- severity: low

## Add section / Remove section act only on the first selected fragment, though the Fragment picker beside them applies to every selected fragment
- where: apps/chart/src/SequenceEdits.tsx:49,74-85 (SequenceEdits)
- scenario: select two `alt` fragments and press Add section. Only `sel.fragments[0]` gets a section, and the second is unchanged. The buttons' disabled state also comes from the first fragment alone, so with an `opt` first and an `alt` second, Add section is disabled even though the `alt` could take one. The Fragment picker in SequencePanel.tsx:101-104 folds its change over every selected fragment (`foldEach(d, sel!.fragments, …)`), as the Activates/Deactivates selects do over every message, so the panel gives two different answers to "what does an edit to the selected fragments touch". These should fold over `sel.fragments` too, enabled when any of them qualifies.
- evidence: read
- severity: low

## The Sequence panel's "open when the chart holds a sequence" is decided once at mount, so New, Open or Import of a sequence chart leaves it collapsed
- where: apps/chart/src/SequencePanel.tsx:62 (SequencePanel, `useState` initializer)
- scenario: start with an empty flowchart (panel collapsed), then use File › New… → Sequence, or Open/Import a file holding a sequence. ChartWorkspace keeps the same scene and SequencePanel instance (it is not keyed on the replaced chart), so `collapsed` stays `true` and the new chart's sequence tools and edits stay hidden. The doc comment says the panel opens "from the start when the chart already holds a sequence", and a freshly loaded chart is that start.
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

<!-- done: 3 findings, files read: 27 -->
