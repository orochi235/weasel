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

The visual regression suite (`tests/visual/`) captures each demo's canvas and
diffs it against a committed PNG baseline using pixelmatch.

Captures read the canvas **backing store** (`readCanvasPixels` in
`tests/visual/diff.ts`), not an element screenshot. A baseline is therefore
exactly `canvas.width × canvas.height` pixels of what the renderer drew, with
no dependence on page layout, font metrics, borders, scrollbars, viewport size,
or the compositor. Anything drawn over the canvas in the DOM (SVG handle
overlays, HUDs) is not captured, and neither is the CSS background behind a
transparent canvas.

### Runner pinning

Baselines are captured on `ubuntu-22.04` with the headless Chromium pinned by
`package-lock.json`, and `visual.yml` verifies against that same image. Keep the
two workflows' runner images coordinated.

CI remains the canonical capture environment, but baselines are no longer
OS-sensitive in the way they once were: as of the backing-store switch, a local
macOS run passes against CI-captured baselines, with 21 of 25 byte-identical
and the rest sub-1% antialiasing noise on curve-heavy demos. Running
`npm run test:visual` locally is expected to be green — a failure there is a
real signal, not environment drift.

**Still capture baselines via CI rather than locally.** A local capture bakes in
that sub-1% antialiasing delta, which is harmless today but erodes the headroom
under the 2% threshold for no benefit.

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
4. Review the changed PNGs (`git diff --stat tests/visual/baselines/`) and
   visually spot-check any that look wrong before staging.
5. Commit the spec changes (if any) and the new/updated PNGs together.
6. Run `npm run test:visual` locally — it should be green against the fresh
   baselines. If it isn't, something other than environment drift changed.
7. Trigger the verification workflow to confirm green:
   ```bash
   gh workflow run visual.yml
   ```

### Adding a new demo

1. Add the demo to `apps/site/registry.ts` as usual.
2. Create `tests/visual/<demo-id>.spec.ts` following the template in
   `tests/visual/scene.spec.ts`. If the demo mounts more than one canvas, pass
   `captureCanvas`'s `nth` / `expectCanvases` options (see
   `tests/visual/custom-shader.spec.ts`).
3. Capture the baseline via the update workflow above.
4. Commit the spec and the baseline PNG together.

## Adding a `@weasel-js/*` sub-package

The sub-packages under `packages/` (e.g. `gestures`, `history`, `modes`) are
**not independently published**. They reach back into this package's `packages/core/src/`
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
