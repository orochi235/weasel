fixed 9b9f995f5f | **Canceled color or size drag stays applied in the Theme panel** (A). `useThemeEdit` gains `cancel()`, wired to the color fields and the font Size field. It drops the pending frame, rewinds history to before the gesture's first write, drops the redo entry and seals.

fixed 73c9855ed0 | **Renaming a role to its own name forks the theme and records an undo entry** (A).

fixed f962ccec05 | **Style panel's Text color reads the header row** (A). diagram gains `diagramColorOf` and `diagramFontSizeOf`. They read through the same text nodes `setDiagramColor` and `setDiagramFontSize` write, and `setDiagramColor` now shares that filter. Changeset `diagram-color-of` (minor, api).

duplicate of f962ccec05 | **Connector label found by a hand-built id** (B). The same reader finds labels by `dependsOn`; a test covers a label stored under another id.

fixed cc34a3c496 | **Style panel shows no color for translucent or non-hex colors** (B). It now accepts any color `tryParseColor` reads, and the color fields take `alpha`, so a pick no longer drops opacity.

fixed 7dc84f166b | **A theme change re-lays out plots without the caller's `measure`** (B). `applyChartTheme` passes `plotMeasureOf(opts.measure)` to `replacePlotData`, and diagram-formats now exports `plotMeasureOf`. Changeset `diagram-formats-plot-measure-of` (minor, api). In practice `rendererMeasure` and plot's `textMeasure` give the same result for plain plot text. So this fixes a dropped option and a measure that could drift, more than a layout shift you would see today.

No extra defects found. Nothing needed a ruling in `docs/unruled.md`. apps/chart has no package.json, so its app-only fixes carry no changesets.

Checks:
- `npx vitest run --maxWorkers=1`, one file at a time: pass for all of these
  - `apps/chart/src/theme/ThemePanel.test.tsx` (6 passed)
  - `apps/chart/src/theme/StylePanel.test.tsx` (6 passed)
  - `apps/chart/src/theme/applyChartTheme.test.ts` (1 passed)
  - `packages/diagram/src/theme/diagramColorOf.scene.test.ts` (4 passed)
  - `packages/diagram/src/theme/theme.scene.test.ts` (7 passed)
- Fails without the fix: confirmed for the cancel, rename, header-text, translucent and measure tests.
- `npm run typecheck:packages -- diagram diagram-formats`: pass ("diagram ok", "diagram-formats ok").
- apps/chart typecheck (`typescript-7` `tsc -p apps/chart/tsconfig.json --rootDir .`): no errors in changed files. The only errors are from the ad-hoc program itself: css/virtual-module imports and `import.meta.env`.
- eslint on every changed file: pass (exit 0).
- `npm run check:size`: pass ("no file or function grew past its cap").
- `npm run check:changesets`: pass ("OK — 1333 changeset(s)").
- Tree clean; `.skulk/` untouched.