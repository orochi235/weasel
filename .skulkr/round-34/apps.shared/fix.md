- Palette lab, Theme editor and Theme prefs links get a 404 in dev because the theme editor's vite base needs a trailing slash (A+B): fixed fbce3ca2d4
- `otherPrefValue` returns default + 1, above a number leaf's max, when the default is the max and there is no min; a one-option enum throws a TypeError (A): fixed f8076d888f
- `prefsRoundTrip` leaves the first store open when `flush` fails or a `set` throws (A): fixed caf85c791f
- `parsePackageRoute` rejects a trailing slash (`pkg/geom/`), and `pkg/geom/overview/x` parses with a `rest` that `packageRoute` then drops (A): fixed b5057fd759
- The Releases fallback counts Internal entries toward `FALLBACK_MIN_ENTRIES` but never shows them (A): fixed de14cc1262

Extra defects found while fixing:
- The built forge lab link `/weasel/docs/ui/forge` had no trailing slash, though forge's built base is `/weasel/docs/ui/forge/`: fixed fbce3ca2d4 (same commit as the first finding). The new test runs only in dev mode, so this built-mode change was checked by reading the code.
- `#pkg/` (the package index with a trailing slash) still opens nothing. That check lives in `apps/site/Packages/catalog.ts` (`isPackagePage`), outside this area, so I left it alone and did not file it.

No changesets: every change is in the private apps, and the changesets `fixed` group lists only `@weasel-js/*` packages. No calls were added to `docs/unruled.md`. I treated refusing `pkg/<pkg>/overview/<x>` as part of the documented grammar, not a behavior call.

Checks:
- `npx vitest run --maxWorkers=1 apps/shared/labs.test.ts`: pass (1 passed)
- `apps/shared/prefsRoundTrip.test.ts`: pass (3 passed)
- `apps/shared/packageRoutes.test.ts`: pass (9 passed)
- `apps/shared/releases.test.ts`: pass (2 passed)
- Callers of the changed code: `apps/chart/src/prefs.test.ts` pass (5), `apps/draw/src/prefs.roundTrip.test.ts` pass (1), `apps/site/__tests__/kitSettingsSchemas.test.tsx` pass (5), `apps/devtools-extension/src/tabWeasel.test.ts` pass (13)
- `npm run typecheck`: pass (exit 0). I used this instead of `typecheck:packages` because the changes are in apps, not packages.
- eslint on `apps/shared/*.ts`: pass (exit 0)
- `npm run check:size`: pass ("no file or function grew past its cap")
- `npm run check:changesets`: pass ("OK — 1354 changeset(s)")
- Tree clean apart from `.skulk/`.