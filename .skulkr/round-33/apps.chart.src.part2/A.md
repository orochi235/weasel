## The Theme panel ignores a canceled color or size drag, leaving its live edit open and the shipped theme forked
- where: apps/chart/src/theme/useThemeEdit.ts:43 (useThemeEdit `input`), apps/chart/src/theme/themeFields.tsx:12 (ThemeColor), apps/chart/src/theme/ThemePanel.tsx:36 (font Size)
- scenario: the chart is in the shipped Paper theme; drag the Page color well (each `onInput` applies `applyChartTheme` under `coalesceKey: 'theme:page'`, forking Paper into an editable copy), then press Escape. Per docs/conventions.md "Edit callbacks" the control sends `onInput(original)` then `onCancel` and no `onChange`. `useThemeEdit` has no cancel path and the fields pass no `onCancel`, so the revert is applied as one more coalesced write onto the copy: the chart is left on a forked "Paper" copy rather than the shipped theme (Format › Theme › Paper no longer reads active, the panel note loses "The first edit makes a copy"), an undo entry for a canceled edit remains, and `scene.history.seal()` never runs, so the next drag of the same field coalesces into the canceled one and one Undo undoes both. Should: on cancel, drop the pending frame and revert/close the coalesced entry (or not fork until commit), then seal.
- evidence: read (useThemeEdit has `input`/`commit`/`change` only; ColorControls/NumberControls forward `onCancel`; protocol in docs/conventions.md:325-330)
- severity: medium

## Renaming a role to its own name forks a shipped theme and records an undo entry that changes nothing
- where: apps/chart/src/theme/ThemeRoles.tsx:17 (RoleFields), apps/chart/src/theme/useThemeEdit.ts:54 (change)
- scenario: chart in a shipped theme; in Roles, type a trailing space after "Process" and press Enter. The field reports a change ("Process "), which is trimmed to the existing label; `renameThemeRole` always returns a new object (themeEdit.ts:80-81), so `change`'s `next !== base` guard passes and `applyChartTheme` runs: the chart moves to a "Paper (edited)" copy and an undo step "Rename role" appears, though nothing visible changed. Should: skip the edit when the trimmed label equals `role.label`.
- evidence: read
- severity: low

## The Style panel's Text color reads a header shape's header row, which takes the fill color, so it never shows the text color it sets
- where: apps/chart/src/theme/StylePanel.tsx:19 (firstText), :24 (colorOf)
- scenario: select a shape whose diagram trait has a `header` (a UML class or ERD entity, whose row 0 is a header band). `firstText` returns the first child with text, the header row; its `fill` is the box's fill (themeWrites.ts `rowColor`: a header row is "drawn against its band, in the box's fill") or the theme's `headerText`. So the Text well shows the fill color. Setting Text to red through `setDiagramColor(…, 'text', …)` skips the header row (applyTheme.ts:141 `(header && text.bodyRow === 0) !== (field === 'fill')`) and recolors only the body rows, so the well keeps showing the old header color: the edit looks like it did nothing, and a selection mixing a header shape with a plain one reads Mixed when their text colors agree. Should: read the text color from a non-header row, the same rows `setDiagramColor` writes for `text`.
- evidence: read
- severity: medium

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
