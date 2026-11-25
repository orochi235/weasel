Reset/outside load writes an emptied scene into `state.scene` (A+B): fixed c7aedd32f9

`sceneTrialHistory.restore` throws `ExtensionConflictError` on the second restore into the same scene (A+B): fixed b364291884

Overview never repaints `timed` canvas layers (A): fixed be358ef228

`sceneTrialHistory` has no `clear`, so settings entries survive a Reset (A): fixed d6f269c2d6

Extra defects, found by the gate (sweep):

The design-token check in `npm run lint -w @weasel-js/labkit` failed on raw lengths in the font-size calc in `packages/ui/src/components/SpanStrip/SpanStrip.module.css`: fixed 80ead09fec. The stripe height is now one custom property and renders the same, so it has no changeset.

`check:numeric` failed on `apps/draw/src/dev/audits/Treemap.module.css`, which restated `font-variant-numeric`: fixed b0a984aab6. It now composes the shared `numeric` class, so that count also takes the numeric font family.

Checks:
- `npx vitest run --maxWorkers=1 packages/labkit/src/scene/useTrialScene.test.tsx`: pass (2/2)
- `npx vitest run --maxWorkers=1 packages/labkit/src/scene/sceneTrialHistory.test.ts`: pass (7/7)
- `npx vitest run --maxWorkers=1 packages/labkit/src/overview/TrialOverview.timed.test.tsx`: pass (1/1)
- `npx vitest run --maxWorkers=1 packages/labkit/src/overview/TrialOverview.test.tsx`: pass (6/6)
- `npx vitest run --maxWorkers=1 packages/labkit/src/canvas/CanvasStack.test.tsx`: pass (10/10)
- `npx vitest run --maxWorkers=1 packages/ui/src/components/SpanStrip/SpanStrip.test.tsx`: pass (15/15)
- every other `packages/labkit/src/scene/*.test.tsx`, each run alone after the `sceneTrialHistory` fix: pass
- `npm run checks:gate`: pass (all 32 passed)
- `npm run lint -w @weasel-js/labkit`: pass
- `npm run lint -w @weasel-js/ui`: none (the package has no `lint` script)
- `npm run check:changesets`: pass
- Unrun `*.browser.test.*` files: none touched.

tally: 6 of 6 fixed, 2 extra fixed