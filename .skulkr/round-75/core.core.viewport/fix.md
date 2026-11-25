- animateToBounds into a viewport with no area returns true but never calls onDone (A+B): fixed 323f13c539
- useDecayLoop coasts forever on a NaN or infinite velocity (A+B): fixed 96f00a0171. This needed a behavior call, recorded in `docs/unruled.md`: a non-finite velocity ends the coast at once and calls `onEnd`, and does not throw. The velocity is measured at release, and a release never throws. Throwing a `RangeError` was the alternative.
- useNodeOverlayFrame's fallback mapping is shared across node ids (A): fixed f9da7d7d47

No extra defects found.

Checks:
- `npx vitest run --maxWorkers=1 packages/core/src/core/viewport/useDecayLoop.test.ts`: pass (14 passed)
- `npx vitest run --maxWorkers=1 packages/core/src/core/viewport/useViewAnimation.test.ts`: pass (20 passed)
- `npx vitest run --maxWorkers=1 packages/core/src/core/viewport/useNodeOverlayFrame.test.tsx`: pass (15 passed)
- `npm run checks:gate`: the first run failed, with `react-hooks/immutability` errors on my first version of the overlay fix. I amended the fix and reran it: `checks:gate: all 33 passed`
- `npm run lint -w @weasel-js/core`: not run, because `@weasel-js/core` has no `lint` script ("npm error Did you mean this?"). The gate's root `npm run lint` covers it and passed.

tally: 3 of 3 fixed, 0 extra fixed