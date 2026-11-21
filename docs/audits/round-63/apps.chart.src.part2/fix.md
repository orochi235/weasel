- Style panel Role field shows no role for a role the theme no longer has (A): fixed f89f89bab5
- `at()` helper hard-codes the page fit padding instead of using `PAGE_FIT_PADDING` (A): fixed dc3677168f (browser-test helper; no test can reproduce it here)
- Alt distance readout ignores the "only bodies" filter (B): fixed 4048fb7020 (the fix is in `@weasel-js/guides`: the readout now takes a `filter` option and the preset passes its own; has a changeset)
- An imported export of a shipped theme is treated as custom (B): fixed 1835fbc58c (a file equal to a shipped theme comes in as that theme; one that has a shipped id but differs is forked under its own id)
- `unmountChartApp` never restores the body's margin (B): fixed 435e38e935 (browser-test helper; no test can reproduce it here)

Checks:
- `npx vitest run --maxWorkers=1 packages/guides/src/spacingHints/preset.test.ts`: pass (9 passed)
- `npx vitest run --maxWorkers=1 packages/guides/src/spacingHints/distanceReadout.test.ts`: pass (9 passed)
- `npx vitest run --maxWorkers=1 apps/chart/src/theme/StylePanel.test.tsx`: pass (7 passed)
- `npx vitest run --maxWorkers=1 apps/chart/src/theme/themeCommands.test.ts`: pass (4 passed)
- The new preset and StylePanel tests were seen failing before their fixes. The themeCommands test covers a newly exported `importedTheme`, so it could not run before the fix.
- Unrun browser tests: the `apps/chart` `*.browser.test.tsx` files that use `at()` and `mountChartApp`.
- `npm run checks:gate`: pass ("checks:gate: all 32 passed"), including `check:changesets` and root `lint`
- `npm run lint -w @weasel-js/guides`: not run, because the package has no lint script (npm error "Missing script"). The root `npm run lint` inside the gate covers it. `apps/chart` isn't an npm workspace, so it has no lint script either.

tally: 5 of 5 fixed, 0 extra fixed