# Findings: apps.chart.src.part2 (round 69)

## Theme panel unmounting mid-gesture drops the pending value and leaves the gesture's undo entry unsealed
- where: apps/chart/src/theme/useThemeEdit.ts:45 (useThemeEdit)
- scenario: a color or Size field is being dragged (`input` has applied at least one frame, so `before` is set and the entry is open under coalesceKey `theme:<path>`), and the Theme panel unmounts before `commit`/`cancel` arrive (sidebar switches away, the selection change swaps the Format panel). `useVisibleRaf`'s frame is torn down with the last `pending` value never applied, and `scene.history.seal()` is never called. The next edit to the same path, in a later gesture, coalesces into that old entry, so one Undo takes back both edits; and the last dragged value is lost. There is no unmount cleanup that flushes `pending` and seals, as `commit` does.
- evidence: read
- severity: low

## mountChartApp called twice without unmount leaks the first React root and its mount point
- where: apps/chart/src/testing/mountChartApp.tsx:15 (mountChartApp)
- scenario: a test mounts the app twice (e.g. to simulate a reload that reads the saved session) without calling `unmountChartApp` between the calls. `root` and `mountPoint` are overwritten, so the first app is never unmounted and stays in the document with its canvas, listeners and frame loops. `document.querySelector('.wc-host canvas')` then finds the *first* app's host, so the test drives the stale app. `afterEach` unmounts only the second. It should unmount any root already there, or throw.
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

<!-- done: 2 findings, files read: 27 -->
