# Audit round 63 — apps.chart.src.part2 (blind reviewer)

Note: the frozen commit 1b4edb3a93db1759496d564da57eb13020b3d7d2 is not in this clone; read at HEAD 6f634fabe1 (apps/chart/src clean against it).

## The chart's "only bodies" filter is dropped on the Alt distance readout, so Alt over a connector or edge label measures to it
- where: apps/chart/src/useChartSnap.ts:40 (useChartSnap)
- scenario: useChartSnap passes `filter: isBody` to `createSpacingHintsPreset` so connectors and their labels are never lined up with. The preset hands `filter` to the spacing and alignment snap sources only; the readout contribution gets `{ ...sourceId, ...opts.readout, ...color }` and no filter (packages/guides/src/spacingHints/preset.ts:53), and picks its target with `nodeAtPoint` over the whole scene (distanceReadout.ts:106). With "Snap to equal gaps" on, select a shape, hold Alt and hover a connector or an edge label: a distance to the connector's or the label's box is drawn, though the pref ("Hold Alt over a shape to measure its distance from the selection") and the filter both say only shapes count. Expected: the readout ignores what the filter excludes, as the snap sources do.
- evidence: read
- severity: low

## A theme imported from an exported shipped theme keeps the shipped id but is treated as custom: its menu item never reads as held and the copy-on-edit never happens
- where: apps/chart/src/theme/themeCommands.tsx:35 (ThemeCommand `active`), :44 (importTheme)
- scenario: Format › Theme › Export on a chart in Paper writes `themeToJson(DIAGRAM_THEMES.paper)`, id `paper`. Import that file into a chart: `parseDiagramTheme` returns a fresh object with id `paper`, which `applyChartTheme` stores whole. `active: () => chartThemeOf(scene) === theme` compares identity, so Format › Theme › Paper is not marked held although the chart is in exactly Paper; `isShippedTheme` (identity too) is false, so ThemePanel omits "The first edit makes a copy" and edits change a custom theme still named "Paper" with id `paper` in place, which a later export writes as `paper.weasel-theme.json` titled "Paper" though it differs from the shipped one. Whether a chart "is in" a shipped theme is answered by object identity here and by id in the doc value (`diagramThemeFrom` resolves a string id to the shipped object). Expected: an imported theme equal to a shipped id resolves to the shipped theme, or is forked/renamed on import.
- evidence: read
- severity: low

## mountChartApp sets `document.body.style.margin` and unmountChartApp never restores it
- where: apps/chart/src/testing/mountChartApp.tsx:17 (mountChartApp) / :61 (unmountChartApp)
- scenario: a browser test file that calls `mountChartApp` in one test and lays out its own fixture in a later test (or a helper that measures `document.body`) after `unmountChartApp` still sees `margin: 0` on body — teardown leaves state behind. Expected: unmount restores the body's previous inline margin.
- evidence: read
- severity: low

## Files read
apps/chart/src/prefs.ts
apps/chart/src/reportFailure.ts
apps/chart/src/stencilDrop.ts
apps/chart/src/templates/TemplateDialog.tsx
apps/chart/src/templates/templateDialog.css
apps/chart/src/testIcons.ts
apps/chart/src/testing/canvasPixels.ts
apps/chart/src/testing/chartSession.ts
apps/chart/src/testing/choose.ts
apps/chart/src/testing/mountChartApp.tsx
apps/chart/src/testing/pointer.ts
apps/chart/src/testing/savedChart.ts
apps/chart/src/theme/StylePanel.tsx
apps/chart/src/theme/ThemePanel.tsx
apps/chart/src/theme/ThemeRoles.tsx
apps/chart/src/theme/applyChartTheme.ts
apps/chart/src/theme/stylePanel.css
apps/chart/src/theme/themeCommands.tsx
apps/chart/src/theme/themeFields.tsx
apps/chart/src/theme/themePanel.css
apps/chart/src/theme/useThemeEdit.ts
apps/chart/src/toolbar/ChartToolbar.tsx
apps/chart/src/toolbar/toolbar.css
apps/chart/src/toolbar/toolbarAssets.ts
apps/chart/src/useChartDiagram.tsx
apps/chart/src/useChartSnap.ts
apps/chart/src/workspace.css

<!-- done: 3 findings, files read: 27 -->
