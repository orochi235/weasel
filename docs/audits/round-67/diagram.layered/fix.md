- Authored edge with a label reserves an empty label row and drops its own hop (A): fixed 29a68a091f
- Authored edge between adjacent ranks loses its hop when another edge's label row sits between them (B): fixed 29a68a091f. Same span check as A's finding, so one fix covers both.
- settleAcross gives up on a pin when a free multi-rank column shares the rank, even an unrelated one (A+B): fixed 428d1b6d1e. `jump` now leaves a tall column where `squeeze` put it and moves only single-rank items.
- transpose has no global potential once a port has several places, so it can cycle (B): fixed 22e38e66f3. A random search found swaps that raised the total crossings, which confirms the claim, but it found no input that actually loops forever. With a multi-place port in the graph, transpose now counts both hop layers around the rank in full, so every swap it takes lowers the total and the loop ends. That costs one `pairCrossings` per candidate swap, and only on graphs that have such ports. I did not benchmark it.

Extra defects: none.

Checks:
- `npx vitest run --maxWorkers=1 packages/diagram/src/layered/expand.test.ts`: pass (11)
- `npx vitest run --maxWorkers=1 packages/diagram/src/layered/across.test.ts`: pass (3)
- `npx vitest run --maxWorkers=1 packages/diagram/src/layered/order.test.ts`: pass (16)
- `packages/diagram/src/layered/` whole directory: pass (349)
- The 10 diagram test files outside `layered/` that import it: pass (100)
- `npm run check:changesets`: pass
- `npm run checks:gate`: pass (all 32 passed)
- `npm run lint -w @weasel-js/diagram`: not run, because the package has no lint script. eslint on the six touched files: pass

tally: 3 of 3 fixed, 0 extra fixed