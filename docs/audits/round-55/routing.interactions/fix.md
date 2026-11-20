Sweep re-enters the same item when `keyOf` returns object keys (A+B): fixed 00568d57a7
Threshold drag's Escape cancels in the middle of IME composition (A+B): fixed e92cb56bcf
`browserReservedChord` ignores `spec.code` (A+B): fixed 8448227476
Threshold drag reports a far release after a fast flick as a click (A): not a defect. `docs/unruled.md` has a ruling from 2026-11-10: a release past the drag threshold still clicks when no move crossed the threshold first.
Sweep object keys (B): duplicate of the A sweep finding, fixed 00568d57a7
Threshold drag IME Escape (B): duplicate of the A IME finding, fixed e92cb56bcf
`browserReservedChord` code (B): duplicate of the A code finding, fixed 8448227476

No extra defects found.

Checks:
- `npx vitest run --maxWorkers=1 packages/routing/src/interactions/sweep/sweep.test.tsx`: pass (9 passed); the new test failed before the fix
- `npx vitest run --maxWorkers=1 packages/routing/src/interactions/thresholdDrag/thresholdDrag.test.ts`: pass (23 passed); the new test failed before the fix
- `npx vitest run --maxWorkers=1 packages/routing/src/interactions/browserReservedKeys.test.ts`: pass (9 passed); the new test failed before the fix
- `npm run check:changesets`: pass ("OK — 2592 changeset(s).")
- `npm run checks:gate`: pass ("checks:gate: all 32 passed")
- `npm run lint -w @weasel-js/routing`: not run, because the package has no `lint` script (npm error "Missing script"). The gate's root `npm run lint` passed.

tally: 6 of 7 fixed, 0 extra fixed