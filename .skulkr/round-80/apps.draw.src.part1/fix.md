uiFontFamily keeps CSS escapes in a quoted family (A): fixed 5309b32896

effectNodeName looks the kind up in the whole settings schema, unguarded by EFFECT_KINDS (A): fixed 2b1f473cf6. `effectName` now checks the kind against `EFFECT_KINDS` itself, and `drawKindLabel` and `effectNodeName` both use it.

Font holds and export registrations dropped at startup, stacking on each HMR re-evaluation (B): fixed a7f11667b9. `registerAvailableFonts` now returns `{ families, dispose }`, and `main.tsx` releases the fonts and the export formats from `import.meta.hot.dispose`.

No changesets: `apps/draw` is not a published package. It has no `package.json`, so there is no `lint -w` for it; the root `npm run lint` covers it.

Checks:
- `npx vitest run --maxWorkers=1 apps/draw/src/LoupeProvider.test.ts`: pass (3 passed); the new test failed before the fix
- `npx vitest run --maxWorkers=1 apps/draw/src/nodeKinds.test.ts`: pass (5 passed); the new test failed before the fix
- `npx vitest run --maxWorkers=1 apps/draw/src/fonts.test.ts`: pass (12 passed)
- `npx vitest run --maxWorkers=1 apps/draw/src/menuBar.test.tsx` (it calls `registerDrawExports`): pass (15 passed)
- `npm run checks:gate`: all 33 passed, including the root `npm run lint`

tally: 3 of 3 fixed, 0 extra fixed