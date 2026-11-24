- `layers` slot given as `undefined` drops the preset's layer (A+B): fixed e934a64c21
- `routing` doc says the default routing classifies text, but `inferredNodeRouting` has no text entry (A+B): fixed 447d0147c5
- `oneOf` and `mergeByKey` settle the same preset conflict differently (B): fixed 87c81b81e4. `mergeByKey`'s result also depended on preset order (sweep, folded into the same fix). Now both throw whenever two presets give different values and neither refines the other. This is a strict call nobody has ruled on, so it is recorded in `docs/unruled.md`.

Checks:
- `npx vitest run --maxWorkers=1 packages/core/src/canvas/SceneCanvas/mergeLayers.test.ts`: pass (4/4). It failed before the fix.
- `npx vitest run --maxWorkers=1 packages/editing/src/integration/core/canvas/SceneCanvas/features.test.ts`: pass (38/38). Its two new conflict tests failed before the fix.
- `npx vitest run --maxWorkers=1 packages/core/src/canvas/SceneCanvas.presetBuild.test.tsx`: pass (8/8)
- `npx vitest run --maxWorkers=1 packages/core/src/canvas/SceneCanvas/presetChromeRules.test.ts`: pass (3/3)
- `npm run check:changesets`: pass
- `npm run checks:gate`: pass ("all 33 passed", including the root `npm run lint`)
- `npm run lint -w @weasel-js/core` and `npm run lint -w @weasel-js/editing`: not run. Neither package has a `lint` script ("Missing script"); the root `npm run lint` in the gate passed.

The tree is clean.

tally: 3 of 3 fixed, 0 extra fixed