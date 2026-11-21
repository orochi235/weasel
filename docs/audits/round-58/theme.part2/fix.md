themePrefsValues falls back missing selections like the schema, from A: fixed added9ca0a

Override hook set at only some selections shows another selection's value there, from B: fixed 99b1e607cb. It now reads as the hook's manifest fallback, which is what the page draws. The schema and themePrefsValues now share one lookup, `rowCssAt` in `prefs/tokens.ts`.

A dimension token at a bare `0` gets a unitless number leaf, so an edit pins an invalid length, from B: fixed 66b80d3615. A bare `0` now takes the unit of the token's other values, or px where they have none. `prefOfCss` reads a bare `0` on any number leaf that has a unit. The property test `prefs.pbt.test.ts` now treats `0` and `0px` as equal.

Checks:
- `npx vitest run --maxWorkers=1 packages/theme/src/prefs/prefs.test.ts`: pass (26 passed)
- `npx vitest run --maxWorkers=1 packages/theme/src/prefs/prefs.pbt.test.ts`: pass (2 passed)
- `npx vitest run --maxWorkers=1 packages/theme/src/prefs/schema.shrunk.test.ts`: pass (2 passed)
- `npm run checks:gate`: pass ("checks:gate: all 32 passed"). The first run failed `check:changesets` on a title that was too long; I fixed it and squashed the fix into 99b1e607cb.
- `npm run lint -w @weasel-js/theme`: not run, because the package has no `lint` script. `npx eslint packages/theme/src/prefs/*.ts` passed (exit 0).

tally: 3 of 3 fixed, 0 extra fixed