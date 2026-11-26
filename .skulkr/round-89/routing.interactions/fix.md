- containsComposed treats a detached link's URL `host` string as a shadow host and throws (A): fixed 84174725f5
- pointerSession's `onEnd` docs say it fires before teardown, but teardown runs first (A): fixed 9a6fcedf26. The docs now describe what the code does: `onEnd` and `onCancel` fire after teardown. I kept that order and added a test that holds it.
- A sticky rect stuck to the viewport reads the root's rect, which scrolls, so its correction comes out inverted (B): fixed 2a6037fa96
- `transform-style: preserve-3d` and `offset-path` are missing from the fixed-containing-block test (B): fixed 4f227d58b4. I also added `will-change: offset-path`.
- `overflow: clip` is taken for a sticky box's scroll container (B): fixed b85a7df6d3. Only a hidden, scroll, or auto overflow on either axis now counts as a scroller.

Each fix has its own changeset.

Checks:
- `npx vitest run --maxWorkers=1 packages/routing/src/interactions/elementAt.test.ts`: pass (2/2)
- `npx vitest run --maxWorkers=1 packages/routing/src/interactions/pointerSession/pointerSession.test.ts`: pass (25/25)
- `npx vitest run --maxWorkers=1 packages/routing/src/interactions/handleDrag/handleDrag.test.ts`: pass (40/40)
- `npm run checks:gate`: pass ("checks:gate: all 33 passed")
- `npm run lint -w @weasel-js/routing`: not run. The package has no `lint` script, only `test` and `build`. The root `npm run lint` passed inside the gate.

tally: 5 of 5 fixed, 0 extra fixed