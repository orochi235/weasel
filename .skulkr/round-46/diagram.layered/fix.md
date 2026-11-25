All six findings were real; each is fixed with a test that fails before the fix (checked against the old code), and `checks:gate` passes.

- Cluster column ignores `minWidth`, so a held pin can land inside a titled cluster's box (A): fixed de12a04d12
- Column padded by nested insets on both sides, wider than the drawn box (A): fixed de12a04d12. Same `spanOf` rewrite as the finding above: both now get their width from one new helper, `layered/clusterSpans.ts`.
- `turnOutward`'s drawing span ignores `minWidth` (A): fixed 78a236e321. It now uses the same `clusterSpans` helper.
- `levelRoutes` doesn't treat cluster boxes as obstacles, so a level edge runs through a cluster neither end is in (A): fixed 99e4ae01f3
- A level edge's detour runs through a box between the ends that reaches further toward the next rank than either end (B): fixed 1f24ba1563
- A level route's two detour points are read back as a placeholder seed on the next pass (B): fixed c7ee54dc32. The layered layout's public output never changed in my probes, so the test checks the seeding directly through `planPass` and `routed`, now exported from `plan.ts`. `layered.ts` doesn't re-export them, so the package's public API is unchanged.

Extra problems found while fixing (all caused by my own changes, caught by the gate):
- `level.ts` imported `boxAround` from `clusterBox.ts`, which reaches React and the DOM, and broke `check:needs` for `diagram/layout`: fixed ac277e21ff. `boxAround` now lives in `cluster.ts`, and `clusterBox.ts` re-exports it.
- An unused `Rect` import left behind by that move failed typecheck and lint: fixed fe722e9a3c
- One changeset title was over 140 characters: fixed 1f2422b708

Checks:
- `npx vitest run --maxWorkers=1` on each touched file: `level.test.ts` 13 passed, `plan.test.ts` 2 passed, `across.test.ts` 2 passed, `inward.test.ts` 2 passed.
- The rest of `packages/diagram/src/layered/*.test.ts`, one at a time:
  - `expand.test.ts` 9 passed
  - `layered.cloud.test.ts` 11 passed
  - `layered.test.ts` 273 passed
  - `order.test.ts` 15 passed
  - `place.test.ts` 9 passed
- `clusterBox.pbt.test.ts` failed once in a batch of 11 diagram test files, then passed 5/5 on its own twice. It builds its scene with `layout: 'none'`, so no layered code runs; I read it as contention.
- `npm run checks:gate`: "checks:gate: all 32 passed"
- `npm run lint -w @weasel-js/diagram`: the package has no `lint` script (npm "Missing script"). I ran eslint on every changed `.ts` file instead: pass, exit 0.
- `npm run check:changesets`: "OK — 2031 changeset(s)."
- The tree is clean, and `.skulk/` is untouched.