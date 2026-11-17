# Audit round 33 — apps.chart.src.part2 (reviewer findings)

## A theme change re-lays out every plot with the default text measure, dropping the caller's `measure`
- where: apps/chart/src/theme/applyChartTheme.ts:14 (applyChartTheme)
- scenario: every caller (themeCommands.tsx:34, :49, useThemeEdit.ts:33, :58) passes `measure: rendererMeasure` in `opts`, and `applyDiagramTheme` gets it, but `replacePlotData` is called with only `{ label, theme }`, so `compilePlot` falls back to `textMeasure` (packages/plot/src/plotScene.ts:104). A plot placed from a template or an added page is compiled with `rendererMeasure` (NewChartDialog.tsx:18, AddPageDialog.tsx:18); choosing any theme, or dragging one theme color, recompiles it with a different measure, so text-sized layout (axis labels, legend, tick room) can shift on a change that should only recolor. Should pass `measure: opts.measure` through.
- evidence: read
- severity: medium

## The Style panel shows no color for shapes drawn in a translucent theme color
- where: apps/chart/src/theme/StylePanel.tsx:12 (HEX / colorIn)
- scenario: the Theme panel's color fields take alpha (`ThemeColor` passes `alpha`, and `stored` keeps `#rrggbbaa` when not opaque, themeFields.tsx:7,13), and `themeWrites` copies the theme's color string into each shape's `paint.color` as-is (packages/diagram/src/theme/themeWrites.ts:73–80). Set the default role's fill to 50% opacity, select a shape: `colorIn` accepts only `/^#[0-9a-f]{6}$/i`, so it returns `undefined` and the Fill (and Stroke/Text, likewise) field shows empty and not mixed, as if the shape had no color, though every selected shape agrees on one. An imported theme naming colors as `rgb()` or a name hits the same path. Should read the 8-digit form too (and ideally any color the theme validator accepts).
- evidence: read
- severity: medium

## The Style panel finds a connector's label by a hand-built id while the color write finds it by its dependency
- where: apps/chart/src/theme/StylePanel.tsx:21 (firstText)
- scenario: for a connector, `firstText` reads `scene.get(`${s.id}/label`)`, re-deriving the id that `edgeLabelIdOf` (packages/diagram/src/edgeLabel.ts:36) owns, while `setDiagramColor` — the write this field drives — finds a connector's labels as nodes with `dependsOn === [id]` and a `diagram.label` trait (packages/diagram/src/theme/applyTheme.ts:112–117). A label whose id is not `<edge>/label` (one made by a path other than `diagramScene`/the edit-label action, or a second label) is recolored by the Text field but never read back by it, so the field shows the old (or no) value after the edit. One answer to "this connector's label" should serve both.
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
