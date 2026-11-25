Reviewer B's report was empty, so all three findings came from A. Two are fixed and committed. The third (hook fallbacks) is fixed only where a hook has one true fallback. Hooks whose fallback differs by read site, including the finding's lead example `tree-indent`, are left as an open question. All checks pass.

- **Second same-named theme inherits the first's tokens** (A): fixed fb27d168b8. The first definition's rule now carries `:where(:not([data-wzl-variant]))`, so it no longer matches the second definition's elements.
- **`httpThemeApi.get('list')` returns the list body typed as a theme** (A): fixed f5f6430274. `get` throws and `put` answers `invalid` for a name the store cannot hold, including `list`, without sending a request. The client and `scripts/theme-store.ts` now share one name rule, `isStorableThemeName`.
- **Hook `value` disagrees with the fallback kit CSS reads** (A): partly fixed b7123b4e1a, partly a question.
  - `prop-row-h` now lists `var(--wzl-field-h, var(--wzl-control-h))`.
  - Hooks whose reads fall back differently by site are marked with a new `varies` field. That covers `tree-indent`, `tree-leading-size`, `button-icon-size`, `params-label-tracking`, and nine more.
  - `check:token-reads` now fails any read of an unmarked hook whose fallback is not the hook's listed value.
  - Question, recorded as Open in `docs/unruled.md`: how the theme prefs schema should show a `varies` hook's unset value. Today it shows one of the site fallbacks, and pinning it changes the reads that fall back to another.

Found while fixing:
- **Three more hooks listed a fallback no read uses** (sweep): fixed b7123b4e1a, the same mistake as the finding above. They are `disclosure-fill` (`var(--wzl-accent)`), `disclosure-target` (`var(--wzl-control-h-sm)`), and `prefs-rail-width` (`176px`). `TOKEN_MANIFEST` was regenerated.

Checks:
- `npx vitest run --maxWorkers=1 packages/theme/src/applyTheme.release.test.ts`: pass (8)
- `npx vitest run --maxWorkers=1 packages/theme/src/store.test.ts`: pass (4)
- `npx vitest run --maxWorkers=1 scripts/check-token-reads.test.ts`: pass (21)
- Also run, since the change touches them, all pass:
  - theme's `applyTheme`, `axes.shrunk`, `blendTheme`, `react`, `generated`, `emit`, and `prefs` tests
  - `scripts/theme-store`, `theme-store.atomic`, and `vite-theme-store` tests
  - prefs `KitSettingsFromPrefs`, core `SurfaceCanvas`, forge `cssVars` and `cssVarUse`, and theme-editor `ThemePrefs`
- `packages/theme/src/strayCloser.browser.test.ts`: unrun (browser).
- `npm run checks:gate`: pass, "checks:gate: all 32 passed"
- `npm run check:changesets`: pass
- `npm run lint -w @weasel-js/theme`: the package has no lint script; the root `lint` in the gate passed.
- The tree is clean.

tally: 2 of 3 fixed, 3 extra fixed