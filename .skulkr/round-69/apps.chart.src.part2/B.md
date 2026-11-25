# Audit round 69 — apps.chart.src.part2

## Theme panel unmounted mid-gesture leaves the gesture's undo entry unsealed, so the next edit of that path merges into it
- where: apps/chart/src/theme/useThemeEdit.ts:30 (useThemeEdit)
- scenario: the user drags a Theme panel color (`input` has applied at least once under `coalesceKey: theme:<path>`, `before` set), then the panel closes before `commit`/`cancel` runs (the Close theme button, or the Format sidebar switching away). Nothing in the hook runs on unmount: `pending` is dropped with the frame loop, `history.seal()` is never called, and `before` is gone with the ref. A later edit of the same path, from a fresh panel, uses the same coalesce key and joins the stale open entry, so one Undo takes back both the abandoned drag and the new edit. It should seal (or cancel) the running gesture on unmount, as `commit` and `cancel` do.
- evidence: read (hook has no unmount cleanup); the merge depends on the history coalescing by key until `seal`, which is inferred from `commit`/`cancel` calling `seal` to end the entry
- severity: low

## `commit` on one path discards a still-pending `input` on another
- where: apps/chart/src/theme/useThemeEdit.ts:53 (useThemeEdit commit)
- scenario: `input(A, v)` queues A for the next frame; before that frame, `commit(B, w)` runs (focus moves from one color field to commit another, e.g. a typed value committed on blur while the first one's drag frame is still pending). `commit` cancels the frame and sets `pending.current = null` without flushing, so A's last value is never applied and the field shows the pre-drag value. `input` already flushes a pending entry of another path (line 49); `commit` should do the same before applying B.
- evidence: read
- severity: low

## `useTool` builds a RegExp from a tool name without escaping it
- where: apps/chart/src/testing/chartSession.ts:41 (chartSession useTool)
- scenario: `useTool('Text (T)')` or any tool name holding `(`, `+`, `.` or `?` builds `^Text (T)`, which matches `Text T` rather than the literal name, so the button lookup misses (or matches a different button) and the test fails or clicks the wrong tool. The name should be escaped before going into the pattern.
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
