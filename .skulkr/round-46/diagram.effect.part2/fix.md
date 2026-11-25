- A throwing or rejecting `show`/`preview` fails the whole run and leaks that stage's bitmaps (A+B): fixed e880f97348
- A `many` input gets only its first wire's value (A+B): fixed 0b2ed961ee. **Question:** the evaluator now gets an array of every reached wire's value, and a bypassed stage passes the first one on. Nobody had ruled on this, so it's logged in `docs/unruled.md`. Its changeset is `major` + `breaking`, because an evaluator with a `many` input now reads `unknown[]`.
- `setOptions` doesn't restart a step run (A): fixed 0ff54a5893. An option set to `undefined` now goes back to its default (`evaluators` excepted), and `setSources(undefined)` is accepted.
- `useEffectRunner` keeps an option the caller stops passing (A+B): fixed e08017748c
- `mainChain` caches a path a loop cut short, so the answer depends on stage order (A+B): fixed 7342cf4730. Cut paths are no longer cached, up to a 20,000-stage walk budget so a dense loop still finishes.
- `freeSpot` loops forever on a view far from the origin (B): fixed 28e87a7ba1. Before the fix this hangs, so the new test can't be shown failing; a node loop capped at 10⁶ steps confirmed the hang.
- A `~lane:` stage id collides with the lanes look's lane nodes (A): fixed 1cf66d99b0. The same fault was in `rack`'s `~tap:`/`~skip-*` port ids, so the fix covers both. **Question:** every stage and port id starting with `~` is now reserved; `checkPipeline` reports it as `reserved-id`, and `rack` and `lanes` throw naming it. This is also logged in `docs/unruled.md`.

Extra defects found while fixing: none.

Checks:
- `npm run checks:gate`: first run failed 3 of 32 (`typecheck`, `typecheck:packages`, `check:proto-index`, all from my own changes). I fixed them, folded the fixes into their commits, and the rerun passed: "checks:gate: all 32 passed".
- `npm run lint -w @weasel-js/diagram`: the package has no `lint` script (only `build` and `test`). I ran eslint on every changed `.ts`/`.tsx` file instead: pass.
- `npm run check:changesets`: pass (inside the gate).
- Test files, each run alone with `--maxWorkers=1`: all pass — `runner/runPipeline.test.ts` (16), `runner/runner.test.ts` (13), `runner/useEffectRunner.test.tsx` (3), `mainChain.test.ts` (10), `place.test.ts` (5), `check.test.ts` (15), `lanes.test.ts` (18), `rack.test.ts` (29). Also run as neighbors, all pass: `EffectChart.test.tsx` (13), `EffectEditor.run.test.tsx` (3), `editorMapping.test.ts` (13), `lanes.routes.test.ts` (53).
- Browser tests: none touched.
- Tree is clean.