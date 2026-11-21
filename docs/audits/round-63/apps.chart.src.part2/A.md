# Audit round 63 — apps.chart.src.part2

## Style panel's Role field shows no role for a shape whose role the theme no longer has, though it draws in the default role
- where: apps/chart/src/theme/StylePanel.tsx:42 (StylePanel)
- scenario: Add a role in the Theme panel ("New role"), set a shape to it, then remove the role (`removeThemeRole` → `applyChartTheme`). The shape's `data.diagram.style` still names the removed id, and drawing resolves an unknown role to the default style (`packages/diagram/src/theme/resolve.ts:18`, `themeRoleStyle(...) ?? defaultRoleStyle(theme)`). The panel instead computes `s.state.role ?? theme.defaultRole`, which only falls back for an *unset* role, so `role.value` is the orphan id, matching none of the `themeRoles(theme)` options: the Role toggle shows nothing pressed. With that shape and a default-role shape selected together, the field reads "mixed" although both are drawn identically. The same happens after importing or switching to a theme that lacks a role a shape names. Should resolve the role the way the renderer does (an id not in `theme.roles` reads as `theme.defaultRole`).
- evidence: read
- severity: low

## The browser-test `at()` helper hard-codes the page fit's padding instead of using the app's constant
- where: apps/chart/src/testing/canvasPixels.ts:9 (at)
- scenario: The app fits the page with `PAGE_FIT_PADDING` (`apps/chart/src/pages/useFittedView.ts:30`, defined in `pages/useChartPages.ts:6`); `at()` repeats the same fit with a literal `{ padding: 24 }`. The two agree today, but the answer to "where is world (x, y) on screen" is given in two places: changing `PAGE_FIT_PADDING` moves every shape the app draws while every chart browser test keeps pressing at the old client points, so drags and pixel reads land off target and the tests fail (or pass on the wrong pixels) with no link back to the cause. Should import `PAGE_FIT_PADDING`.
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
