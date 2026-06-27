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

When an intentional code change alters canvas output, or when bootstrapping
the rig for the first time:

1. Pull the latest main branch.
2. Trigger the **Visual Regression — Update Baselines** workflow on GitHub
   Actions:
   ```bash
   gh workflow run visual-update.yml
   gh run watch  # follow until the run completes
   ```
   Or trigger it from the Actions tab in the GitHub UI.
3. Download the captured baselines artifact:
   ```bash
   gh run download <run-id> --name visual-baselines --dir tests/visual/baselines
   ```
4. If `tests/visual/baselines/.gitignore` still exists, delete it now (first
   commit of baselines for the rig).
5. Review the changed PNGs (`git diff --stat tests/visual/baselines/`) and
   visually spot-check any that look wrong before staging.
6. Commit the spec changes (if any) and the new/updated PNGs together.
7. Trigger the verification workflow to confirm green:
   ```bash
   gh workflow run visual.yml
   ```

**Local capture is not supported.** Baselines are pixel-exact and must come
from `ubuntu-22.04` with the Playwright Chromium pinned by
`package-lock.json`. macOS / Windows / `ubuntu-latest` captures will not
match CI.

### Adding a new demo

1. Add the demo to `apps/site/registry.ts` as usual.
2. Create `tests/visual/<demo-id>.spec.ts` following the template in
   `tests/visual/scene.spec.ts`.
3. Run `npm run test:visual:update` (on the correct runner) to capture the
   baseline.
4. Commit the spec and the baseline PNG together.

## Adding a `@weasel-js/*` sub-package

The sub-packages under `packages/` (e.g. `gestures`, `history`, `modes`) are
**not independently published**. They reach back into this package's `src/`
internals (via the shared tsconfig aliases) and are **bundled into
`@weasel-js/core`'s `dist/`** — both JS and `.d.ts`. They are an internal
source-organization tool, not public dependencies.

When `@weasel-js/core` imports from a new sub-package, do **all** of the
following or the built `dist` will leak unresolvable specifiers to consumers
(bare `@weasel-js/<name>` / `core/ops/*` imports → `TS2307`, and worse, a
silently-empty `DepSchema`):

1. **`package.json` — list it under `devDependencies`, never `dependencies`.**
   tsup builds its `.d.ts` `external` set from `dependencies` + `peerDependencies`;
   anything there is force-externalized in the emitted declarations even though
   the JS is inlined. (It's bundled, so consumers never `npm install` it.)
2. **`tsconfig.json` — add a `paths` alias** mapping `@weasel-js/<name>` →
   `./packages/<name>/src/index.ts` (mirror the existing `@weasel-js/ui`
   entries). This makes both esbuild and `rollup-plugin-dts` treat it as
   program-internal source and inline its declarations alongside `core/*`.
3. **`tsup.config.ts`** already inlines `^@weasel-js/` for the JS bundle via
   `noExternal`; no change needed, but read the comment there for why.

Avoid cross-module **`declare module './other'` augmentations** for any type
that ships in the public API (e.g. how `DepSchema` is assembled): those do
**not** survive `.d.ts` bundling — `rollup-plugin-dts` flattens both files into
one chunk and the augmentation no longer targets anything, silently emptying the
interface for consumers. Declare such interfaces directly with their fields in
one place (consumers can still augment via `declare module '@weasel-js/core'`).

**Guard:** `npm run test:smoke:consumer` (part of `prepublishOnly` / CI) bundles
*and* typechecks a synthetic third-party consumer against the built `dist`,
outside the monorepo. It fails on any leaked specifier or empty `DepSchema`. If
you change packaging, run it locally.
