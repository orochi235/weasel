The fixes are committed and `checks:gate` passes, with one change for the controller to know about: `movedIndex` and `isNoopDrop` now require the list's length, which breaks their API (`major` changeset), and I recorded that call in `docs/unruled.md`.

- framesSweep runs a whole pass of a run shorter than one, `loop` below 1 (A) — not a defect: the clock plays any `loop` below 1 as one whole pass (`passesOf` is `Math.max(1, loop)`, `clock/src/place.ts`), so walking a full pass is right. A's suggested fix would have made it wrong. The real defect is B's, below.
- framesSweep counts passes differently from the clock for `loop` 0, a fraction below 1, or a negative number (B) — fixed f08b3a3830
- rangeSweep treats finite ends whose difference overflows as an endless range (A) — fixed 2853c6019c
- movedIndex reads a gap past the end, or an index outside the list, differently from moveItems (A) — fixed 4fcfa1f9f6. Both functions now take `length`, and every caller in `ui` and `diagram` passes it.
- movedIndex and isNoopDrop read a gap past the end differently from moveItems (B) — duplicate of A's movedIndex finding, fixed in the same commit (4fcfa1f9f6)
- soloFrom and soloSweepFrom ignore `enabled` in a single selection (A) — fixed 40cda53a40
- sliderAt returns NaN for a stepped track whose min is -Infinity (B) — fixed 3cd7b6a9e5. The step grid now starts at `max`, or at 0 when both ends are infinite.

No extra defects found.

Checks, with results:
- Each touched test file, run alone with `--maxWorkers=1`: pass. That covers `sweep.test.ts`, `sweep.pbt.test.ts`, `reorder.test.ts`, `reorder.pbt.test.ts`, `selection.test.ts`, `selection.pbt.test.ts`, `slider.test.ts` and `slider.pbt.test.ts`. The new tests failed against the original code before each fix.
- The callers' test files, also run alone: pass. These are diagram `chainEdit`, `reorder` and `reorder.pbt`, and ui `useBarReorder`, `useBarReorderKeys`, `ListEditor.reorder`, `PageTabs`, `PageTabs.along`, `TokenField`, `treeMoves`, `treeMoves.pbt` and `useReorderDragList`.
- Not run: the browser tests `Bar.reorder.browser.test.tsx`, `PageTabs.browser.test.tsx` and `TokenField.browser.test.tsx`, which can't run here. They cover callers I edited but weren't changed.
- `npm run checks:gate`: pass ("checks:gate: all 32 passed").
- `npm run lint -w <pkg>` for ui-input, ui and diagram: none of the three has a `lint` script, so the command errors. Their files are covered by the root `npm run lint` inside the gate, which passed, and `npx eslint` on the changed files reported nothing.
- `npm run typecheck:packages -- ui-input ui diagram`: pass. `npm run check:size`: pass. `npm run check:changesets`: pass.
- The tree is clean apart from `.skulkr/`.

tally: 6 of 7 fixed, 0 extra fixed