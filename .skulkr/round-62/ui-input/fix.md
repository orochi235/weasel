[r56-4] `sliderAt` under `strict` with no stops returned the raw, unclamped track value (carried): fixed 6d41c3601a

[r57-2] `sliderKey` with stops and `ordered` landed a thumb between stops when the next stop was its neighbor's (carried): fixed 25526097cc

[r57-4] A sweep's `at` answered `NaN` or `undefined` for a `NaN` fraction (carried): fixed b84c96a93f. This needed a behavior call nobody had made. I chose to throw a `RangeError` from every sweep, and recorded it in `docs/unruled.md`; treating `NaN` as 0 was the alternative. No non-test caller reads `at`, so nothing that ships now throws because of it.

Extra defects: none.

Checks:
- `npx vitest run --maxWorkers=1 packages/ui-input/src/slider.test.ts`: pass (23 passed)
- `npx vitest run --maxWorkers=1 packages/ui-input/src/slider.pbt.test.ts`: pass (9 passed)
- `npx vitest run --maxWorkers=1 packages/ui-input/src/sweep.test.ts`: pass (21 passed)
- `npx vitest run --maxWorkers=1 packages/ui-input/src/sweep.pbt.test.ts`: pass (8 passed)
- `npm run checks:gate`: pass (all 32 passed)
- `npm run check:changesets`: pass
- `npm run lint -w @weasel-js/ui-input`: not run, because the package has no `lint` script

tally: 3 of 3 fixed, 0 extra fixed