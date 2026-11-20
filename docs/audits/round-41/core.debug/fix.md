Layers panel lists hidden layers and orders and numbers them by the raw array instead of the painted stack (A): fixed aaf6e12516

Worker-mode paints never record paint, draw-call, or per-layer stats (A): fixed 7e9432034d

Changing `highlight` on each devtools hover rebuilds the sink and overlay, wiping their state (B): fixed 7783f9cd44

A `theme`/`strokes` entry set to `undefined` overrides the default and an undefined stroke throws (B): fixed 7b87823d05

Frame-rate readout averages across idle gaps (B): fixed 03d8783b01

Id labels drawn 11 px down as if `y` were a baseline (B): fixed ec36dc9cf0

Extra defects found while fixing: none.

Checks:
- `npx vitest run --maxWorkers=1 packages/core/src/debug/createDebugOverlayLayer.test.ts`: pass (13/13)
- `npx vitest run --maxWorkers=1 packages/core/src/debug/useDebugSink.test.ts`: pass (4/4)
- `npx vitest run --maxWorkers=1 packages/core/src/canvas/renderWorker/workerStack.test.ts`: pass (9/9)
- `npx vitest run --maxWorkers=1 packages/core/src/debug/frameStats.test.ts`: pass (1/1)
- `npx vitest run --maxWorkers=1 packages/core/src/debug/createDebugSink.test.ts`: pass (8/8)
- `npx vitest run --maxWorkers=1 packages/core/src/debug/highlight.test.ts`: pass (2/2)
- `npx vitest run --maxWorkers=1 packages/core/src/canvas/renderDebugSnapshot.test.ts`: pass (2/2)
- `npm run checks:gate`: pass ("checks:gate: all 32 passed")
- `npm run check:changesets`: pass ("OK — 1936 changeset(s).")
- eslint on every changed file, named one by one: pass (after the fix in 7783f9cd44)
- `npm run lint -w @weasel-js/core`: unrun. The PreToolUse hook refused it as "a suite-sized npm script, and this is the controller". The gate's root `npm run lint` and `typecheck:packages` passed.
- Tree clean; `.skulk/` untouched.