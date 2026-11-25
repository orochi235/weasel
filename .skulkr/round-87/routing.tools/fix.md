Step actions and option tuning picking the live tool two ways (A): fixed 429e8ed2eb

Step actions and option tuning picking the live tool two ways (B): duplicate of A's step-actions finding (fixed 429e8ed2eb)

Mount order deciding whether a child's `toolOptionValues` or the canvas's `values` wins (A): fixed 4aa8519393. This needed a behavior call nobody had made. My call: the canvas prop always wins, and a child's store answers only when the canvas is given none. It is recorded in `docs/unruled.md`.

A shared enum, string, or mismatched-kind option keeping only the first tool's schema (B): fixed 9d288b4ae4. A shared enum now takes every tool's options, and a shared string takes the longest `maxLength`. Two tools naming one shared key with leaves of different kinds now makes `toolOptionsPrefs` throw. The throw is a call nobody had made, recorded in `docs/unruled.md`.

Checks:
- `npx vitest run --maxWorkers=1 packages/routing/src/tools/toolOptionPrefs.test.ts`: pass (17)
- `npx vitest run --maxWorkers=1 packages/routing/src/tools/tuneToolOptions.test.ts`: pass (8)
- `npx vitest run --maxWorkers=1 packages/routing/src/tools/useToolOptionValues.test.tsx`: pass (4)
- `npx vitest run --maxWorkers=1 packages/routing/src/tools/toolOptionSteps.test.ts`: pass (2)
- `npm run checks:gate`: pass ("checks:gate: all 33 passed"). The first run failed on a TS2352 cast in `toolOptionPrefs.test.ts`; that is fixed in 9d288b4ae4.
- `npm run check:changesets`: pass, with no warnings on this round's changesets
- `npm run lint -w @weasel-js/routing`: fail, because routing has no `lint` script ("Missing script"). Instead I ran eslint on every file I changed: pass.

The tree is clean.

tally: 4 of 4 fixed, 0 extra fixed