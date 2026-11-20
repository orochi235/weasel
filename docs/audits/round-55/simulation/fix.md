- **Clock: `restart()` from `onEnd` was lost** (A+B): fixed 0d2a0df85e
- **Clock: every owed step runs in one frame, with no cap** (A): not a defect. `docs/unruled.md` already rules this "left as is", and its docs say to declare such a clock `seekable: false`.
- **A non-finite `fx`/`fy` pin writes NaN into `x`/`y`** (A): fixed f268a3e2cb. This needed a behavior call, so I made one: the node keeps its current position on that axis with zero velocity, rather than resetting to 0 like the free path does. It is recorded in `docs/unruled.md` and in the `fx` doc comment.

No extra defects found.

Checks:
- `npx vitest run --maxWorkers=1 packages/simulation/src/useSimulation.clock.test.ts`: pass (10/10)
- `npx vitest run --maxWorkers=1 packages/simulation/src/createSimulation.test.ts`: pass (9/9)
- `npx vitest run --maxWorkers=1 packages/simulation/src/useSimulation.test.ts`: pass (29/29)
- simulation pbt tests (`useSimulation.clock.pbt.test.ts`, `createSimulation.pbt.test.ts`): pass (4/4)
- `npm run check:changesets`: pass
- `npm run checks:gate`: "checks:gate: all 32 passed"
- `npm run lint -w @weasel-js/simulation`: not run, because the package has no `lint` script. `npx eslint packages/simulation/src` instead: pass, no output.
- Tree clean apart from `.skulk/`.

tally: 2 of 3 fixed, 0 extra fixed