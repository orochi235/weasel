# Contributing to weasel

## Fast inner-loop tests (Test Impact Analysis)

The full vitest suite (~1500+ tests) runs in ~12s, but for tight inner loops
the kit ships two scoped test scripts that ride on vitest's import-graph
analysis:

- `npm run test:changed` — runs only specs whose import graph touches files
  changed since `HEAD`. Ideal for "I made an edit; do related tests still
  pass?" checks before pushing.
- `npm run test:related <file>...` — runs only specs that depend on the
  given files. Useful when you know exactly which sources you touched.
- `npm run test:watch` — vitest's watch mode already does TIA implicitly
  (re-runs only related specs on save). Daily-driver for live coding.

**These scripts are for local fast feedback only.** CI and `prepublishOnly`
both run the full `npm run test`. Affected-test selection has known gaps
(transitive type-only imports, env-dependent behavior); the full suite is
the authoritative gate. Don't rely on `test:changed` to clear a PR — push
and let CI run the full thing.

Playwright suites (`test:visual`, `test:smoke:step1`) don't have native TIA
and are small enough to run in full when needed.

## Visual regression tests

The visual regression suite (`tests/visual/`) captures per-demo screenshots and
diffs them against committed PNG baselines using pixelmatch.

### Runner pinning (IMPORTANT)

Baseline PNGs are pixel-exact and are NOT portable across OS or renderer
versions. They must be captured on `ubuntu-22.04` with headless Chromium (the
version pinned by `package-lock.json`). The `visual.yml` GitHub Actions workflow
enforces this.

**Do not update baselines on macOS, Windows, or an `ubuntu-latest` runner.**
Doing so will produce baselines that fail in CI.

### Updating baselines

When an intentional code change alters canvas output:

1. Pull the latest main branch.
2. Run `npm run test:visual:update` **inside the CI Docker image** or on the
   GitHub Actions runner directly. The fastest path:
   ```bash
   # Option A — push the branch; GitHub Actions captures updated baselines
   # in an artifacts archive (see visual.yml upload-artifact step).
   # Download the artifact, copy the PNGs into tests/visual/baselines/, commit.

   # Option B — use act (local GitHub Actions runner) on Linux:
   act push -W .github/workflows/visual.yml --env UPDATE_SNAPSHOTS=1
   ```
3. Review the diff of changed PNGs in the PR before merging.
4. CI must green before merging.

### Adding a new demo

1. Add the demo to `demo/registry.ts` as usual.
2. Create `tests/visual/<demo-id>.spec.ts` following the template in
   `tests/visual/scene.spec.ts`.
3. Run `npm run test:visual:update` (on the correct runner) to capture the
   baseline.
4. Commit the spec and the baseline PNG together.
