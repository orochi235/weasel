# WebGL Transition — Step 9: Visual Regression Rig + Demo Soak

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:subagent-driven-development` (recommended) or `superpowers:executing-plans` to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

---

## BLOCKED — Step 8 Dependency

**This plan cannot be executed until step 8 ships.**

Step 8 adds `backend?: '2d' | 'gl'` to `<Canvas>` and `<SceneCanvas>`. Every spec in this rig navigates the demo app with `?backend=gl` appended to the URL — that query-string convention only works once the Canvas component reads it. If step 8 has not merged at execution time, stop here and file a blocker. Do not begin task 1.

---

## Goal

Stand up a per-demo visual-regression rig using Playwright + pixelmatch. Capture baseline PNGs for every demo in `demo/demos/` under `backend='2d'`, then drive each demo under `backend='gl'` and assert pixel diff ≤ 2%. Once all demos pass, flip the default `backend` to `'gl'` and start the 30-day soak period at the published demo site. Step 10 (final 2D deletion) cannot begin before that soak completes without a regression bug filed.

No new npm dependencies are required: `@playwright/test@1.47.2` and `pixelmatch@5.3.0` are already `devDependencies`.

---

## Architecture

### Rig layout

```
tests/visual/
  baselines/
    <demo-id>-2d.png         # committed baseline, captured under backend='2d'
    <demo-id>-gl.png         # committed GL screenshot (informational; diff is vs 2d)
  diff.ts                    # harness: screenshot + pixelmatch + assertion
  playwright.config.ts       # visual-test-specific config
  <demo-id>.spec.ts          # one spec per demo (24 specs total)
```

The `baselines/` directory is committed directly to git. At ~30–80 KB per PNG and 24 demos, total baseline storage is ≈ 1–2 MB. Git LFS is not needed at this volume.

### Backend switching via query string

The demo app already serves a single SPA at `http://localhost:5173/` (root Vite dev server serving `demo/index.html`). Demos are selected by hash: `/#insert`. Step 9 adds a query-string reader so that `/?backend=gl#insert` passes `'gl'` to every `<SceneCanvas>` instance on that page.

Each spec navigates twice:
1. `/?backend=2d#<demo-id>` — capture the 2D baseline (or assert against it if already committed).
2. `/?backend=gl#<demo-id>` — capture GL screenshot, diff against the 2D baseline.

The query-string reader lives in `demo/main.tsx` (or `demo/CanvasKitDemo.tsx`) and passes `backend` down to each rendered demo component. The exact implementation is step 8's concern; this plan assumes it is available.

### Wait-for-stable-frame strategy

After navigation, the spec waits for:
1. `page.waitForSelector('canvas')` — DOM ready.
2. `page.waitForFunction(() => document.readyState === 'complete')` — resources loaded.
3. A short RAF-aligned settle: `page.evaluate(() => new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r))))` — two rAF ticks clear any layout-triggered paint.
4. `page.waitForTimeout(150)` — fallback for demos that kick off async work (font load, image decode) in their first render.

For demos with interactive state (scripted drag/click), a second RAF pair is emitted after each input event before the screenshot is taken.

### CI workflow

Visual regression runs in a **dedicated workflow** (`visual.yml`), separate from `ci.yml`. Rationale: pixel determinism requires locking to a single runner image. If visual tests lived in `ci.yml` alongside the regular test matrix (Node 20 × Node 22 on `ubuntu-latest`), GitHub could silently move `ubuntu-latest` to a newer image version and corrupt all baselines without a code change. A separate workflow pins `ubuntu-22.04` explicitly, has its own trigger rules, and does not gate the main CI matrix.

Trade-offs:
- **Downside:** a PR can land that breaks visual output without being blocked by the visual workflow if that workflow is not required in branch protection. Mitigation: add `visual / visual-regression` to the required-checks list in the branch protection rule (document this in `CONTRIBUTING.md`).
- **Upside:** `ci.yml` never fails due to pixel-environment concerns. The test matrix (Node 20 + 22) stays clean and fast.

---

## Required Reading

Before starting:

1. `docs/superpowers/specs/2026-05-08-webgl-transition-plan-design.md` — the **"Visual regression rig"** section. This plan implements exactly what that section specifies.
2. `docs/superpowers/plans/webgl-stepwise-conventions.md` — all entries apply. Specific callouts below per task.
3. `docs/superpowers/plans/2026-05-09-webgl-step-3-done.md` — §smoke test sample patterns (§1 update): use 2D `canvas.screenshot()` via Playwright, not `gl.readPixels`. pixelmatch works on PNG buffers, not raw GL bytes.
4. Existing smoke setup: `packages/weasel-gl/dev/playwright.config.ts`, `smoke.spec.ts`, `synthetic.spec.ts`, `text.spec.ts` — structural reference for config and spec shape.
5. `demo/demos/` — enumerate the full list of demo IDs before writing specs. At time of writing, the registry in `demo/registry.ts` defines 24 demos (see §Demo inventory below).
6. `demo/CanvasKitDemo.tsx` — understand how the SPA routes by hash; backend query-string hook lands here in step 8.

---

## Demo inventory

The following 24 demo IDs are registered in `demo/registry.ts` at time of plan authorship. The implementer must re-enumerate from the actual registry at execution time in case new demos were added during steps 4–8.

```
scene          move           animation      easings        layout
resize         rotate         insert         clone          text
multi-select   actions        virtual-groups nested-groups  compose
quadtree       path-pose      compound-paths bezier-edit    pixel-density
zoom           viewport       debug-overlay  pan
```

Baseline filenames derive from the demo ID: `baselines/<demo-id>-2d.png`.

---

## File structure

Files this plan creates or modifies:

```
tests/visual/
  baselines/                          # NEW — committed PNGs
    <demo-id>-2d.png                  # captured via test:visual:update
  diff.ts                             # NEW — screenshot + pixelmatch harness
  playwright.config.ts                # NEW — visual-specific Playwright config
  scene.spec.ts                       # NEW
  move.spec.ts                        # NEW
  animation.spec.ts                   # NEW
  easings.spec.ts                     # NEW
  layout.spec.ts                      # NEW
  resize.spec.ts                      # NEW
  rotate.spec.ts                      # NEW
  insert.spec.ts                      # NEW
  clone.spec.ts                       # NEW
  text.spec.ts                        # NEW
  multi-select.spec.ts                # NEW
  actions.spec.ts                     # NEW
  virtual-groups.spec.ts              # NEW
  nested-groups.spec.ts               # NEW
  compose.spec.ts                     # NEW
  quadtree.spec.ts                    # NEW
  path-pose.spec.ts                   # NEW
  compound-paths.spec.ts              # NEW
  bezier-edit.spec.ts                 # NEW
  pixel-density.spec.ts               # NEW
  zoom.spec.ts                        # NEW
  viewport.spec.ts                    # NEW
  debug-overlay.spec.ts               # NEW
  pan.spec.ts                         # NEW

.github/workflows/
  visual.yml                          # NEW — dedicated visual regression workflow

demo/
  main.tsx                            # MODIFY (or CanvasKitDemo.tsx) — read ?backend=
  (per step 8 — backend prop wiring)

package.json                          # MODIFY — add test:visual and test:visual:update scripts

CONTRIBUTING.md                       # MODIFY — document runner-image pinning constraint
```

---

## Tasks

### Task 1 — Wire `?backend=` query string in demo app

**Files:** `demo/main.tsx` (or `demo/CanvasKitDemo.tsx`, whichever owns `<SceneCanvas>` rendering)

**Context:** step 8 already added `backend?: '2d' | 'gl'` to `<SceneCanvas>`. This task connects it to a URL query parameter so Playwright can drive backend selection without source changes.

- [ ] In `demo/CanvasKitDemo.tsx` (or wherever the active demo component is rendered), read `new URLSearchParams(window.location.search).get('backend')` at module init time.
- [ ] Cast the result: `const backend = raw === 'gl' ? 'gl' : '2d'` — default to `'2d'` if absent or unrecognized.
- [ ] Pass `backend` as a prop into the rendered demo component if the component accepts it, OR inject it via React context so `<SceneCanvas>` instances deep in each demo receive it without prop-drilling.
- [ ] The cleanest approach: create a `BackendContext` in `demo/` that provides `backend: '2d' | 'gl'`, initialized from the query string, and wrap `<CanvasKitDemo>` (or its root) in the provider. Each demo reads `useContext(BackendContext)` and passes the value to its `<SceneCanvas backend={...}>`.

> Convention note: this task may require light refactoring of individual demos if they hard-code no `backend` prop. Prefer the context approach to avoid touching all 24 demos.

**Verify:** `http://localhost:5173/?backend=gl#insert` mounts `InsertDemo` with `backend='gl'`; `?backend=2d#insert` uses `'2d'`. A `console.log` in `SceneCanvas` during dev is sufficient to confirm.

---

### Task 2 — Create `tests/visual/playwright.config.ts`

**Files:** `tests/visual/playwright.config.ts`

```ts
import { defineConfig } from '@playwright/test';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(here, '../..');

export default defineConfig({
  testDir: here,
  testMatch: /\.spec\.ts$/,
  // Pixel determinism requires a fixed viewport size. All baselines are
  // captured at 1280×800, deviceScaleFactor 1. Changing either value
  // invalidates ALL baselines — regenerate via test:visual:update.
  use: {
    baseURL: 'http://localhost:5174',   // separate port from smoke suite (5173)
    headless: true,
    viewport: { width: 1280, height: 800 },
    deviceScaleFactor: 1,
  },
  // Playwright's built-in snapshot dir is NOT used. diff.ts manages its own
  // baselines/ directory so we have full control over diff thresholds and
  // naming conventions.
  snapshotDir: resolve(here, 'baselines'),
  webServer: {
    command: 'npx vite --config vite.config.ts --port 5174',
    cwd: repoRoot,
    port: 5174,
    reuseExistingServer: !process.env.CI,
    timeout: 60_000,
  },
  // No retries in CI — a failing visual test is a real regression.
  retries: 0,
  workers: 1,   // serial: deterministic ordering for baseline update workflow
});
```

**Notes:**
- Port `5174` separates this from the step-1 smoke suite on `5173`. Both can be running in the same CI job.
- `workers: 1` is intentional: parallel screenshot capture with a shared Vite dev server and React SPA causes hash-navigation races. Serial is safer.
- `deviceScaleFactor: 1` is critical. DPR-dependent canvas output means macOS Retina machines produce 2× canvases that don't match Linux 1× baselines. Locking to 1 in Playwright config keeps baselines portable within the pinned runner image.

---

### Task 3 — Create `tests/visual/diff.ts` harness

**Files:** `tests/visual/diff.ts`

```ts
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { PNG } from 'pngjs';
import pixelmatch from 'pixelmatch';
import type { Page } from '@playwright/test';
import { expect } from '@playwright/test';

export interface DiffOptions {
  /** pixelmatch per-pixel color distance threshold 0–1. Default 0.1. */
  threshold?: number;
  /** Fraction of total pixels allowed to differ. Default 0.02 (2%). */
  maxDiffRatio?: number;
}

/**
 * Navigate to `url`, wait for the canvas to stabilize, capture a screenshot
 * of the first <canvas> element, and return the PNG buffer.
 */
export async function captureCanvas(page: Page, url: string): Promise<Buffer> {
  await page.goto(url);
  await page.waitForSelector('canvas');
  await page.waitForFunction(() => document.readyState === 'complete');
  // Two rAF ticks: first clears any synchronous layout paint; second ensures
  // async effects (React state updates, font loads) have flushed.
  await page.evaluate(() => new Promise<void>((r) =>
    requestAnimationFrame(() => requestAnimationFrame(() => r()))
  ));
  // Extra settle for demos with async resource loading (font atlas, images).
  await page.waitForTimeout(150);
  const canvas = page.locator('canvas').first();
  return await canvas.screenshot();
}

/**
 * After a user interaction, wait for the canvas to repaint before capturing.
 * Call this after each simulated event in a spec's interaction sequence.
 */
export async function waitForRepaint(page: Page): Promise<void> {
  await page.evaluate(() => new Promise<void>((r) =>
    requestAnimationFrame(() => requestAnimationFrame(() => r()))
  ));
}

/**
 * Assert that `actual` (PNG buffer) matches `baselinePath` within tolerance.
 *
 * If UPDATE_SNAPSHOTS env var is set (set automatically by test:visual:update),
 * writes `actual` as the new baseline instead of asserting.
 *
 * @param actual      PNG buffer from captureCanvas()
 * @param baselinePath  Absolute path to the committed baseline PNG
 * @param opts        Tolerance overrides (document per-demo justification in spec)
 */
export function assertMatchesBaseline(
  actual: Buffer,
  baselinePath: string,
  opts: DiffOptions = {},
): void {
  const threshold = opts.threshold ?? 0.1;
  const maxDiffRatio = opts.maxDiffRatio ?? 0.02;

  const isUpdate = process.env.UPDATE_SNAPSHOTS === '1';

  if (isUpdate || !existsSync(baselinePath)) {
    mkdirSync(dirname(baselinePath), { recursive: true });
    writeFileSync(baselinePath, actual);
    return; // No assertion on update; CI never sets UPDATE_SNAPSHOTS.
  }

  const baselinePng = PNG.sync.read(readFileSync(baselinePath));
  const actualPng = PNG.sync.read(actual);

  // Dimensions must match exactly. A mismatch means the viewport changed or
  // the canvas size changed — treat as a baseline invalidation, not a pixel diff.
  expect(actualPng.width, 'Canvas width changed vs baseline').toBe(baselinePng.width);
  expect(actualPng.height, 'Canvas height changed vs baseline').toBe(baselinePng.height);

  const { width, height } = baselinePng;
  const diffPng = new PNG({ width, height });

  const mismatchedPixels = pixelmatch(
    baselinePng.data,
    actualPng.data,
    diffPng.data,
    width,
    height,
    { threshold },
  );

  const diffRatio = mismatchedPixels / (width * height);
  expect(
    diffRatio,
    `Pixel diff ${(diffRatio * 100).toFixed(2)}% exceeds ${(maxDiffRatio * 100).toFixed(0)}% threshold`,
  ).toBeLessThanOrEqual(maxDiffRatio);
}
```

**Notes:**
- `pngjs` is a dependency of `pixelmatch`'s test infrastructure and is likely already resolvable. Verify with `node -e "require('pngjs')"` before relying on it; if missing, `npm install --save-exact --save-dev pngjs@7.0.0`.
- `UPDATE_SNAPSHOTS=1` is the environment-level toggle; `npm run test:visual:update` sets it via `cross-env UPDATE_SNAPSHOTS=1 ...` OR via an explicit `--update-snapshots` flag mapped to it. See task 4 for scripts.
- The diff PNG is computed but not written to disk in this harness (keeps the rig simple). If a PR workflow should artifact the diff image for review, add an optional `diffOutputPath` parameter and `writeFileSync` when provided.

> **Convention §6 (preserveDrawingBuffer):** Playwright's `canvas.screenshot()` uses the browser's built-in screenshot mechanism (composited frame capture), NOT `gl.readPixels`. This bypasses the `preserveDrawingBuffer` concern entirely — the browser composites and captures whatever was last painted, regardless of the WebGL buffer state. This is correct behavior for a visual regression rig. The smoke specs in `packages/weasel-gl/dev/` use `gl.readPixels` because they need raw color values; this rig does not.

---

### Task 4 — Add `test:visual` and `test:visual:update` scripts to `package.json`

**Files:** `package.json`

Add to `scripts`:

```json
"test:visual": "playwright test --config=tests/visual/playwright.config.ts",
"test:visual:update": "UPDATE_SNAPSHOTS=1 playwright test --config=tests/visual/playwright.config.ts"
```

**Notes:**
- `UPDATE_SNAPSHOTS=1` is read by `assertMatchesBaseline` in `diff.ts`. Playwright's native `--update-snapshots` flag is NOT used because this rig manages its own baseline files (not Playwright's snapshot mechanism). Using an env var keeps the logic entirely in `diff.ts` and avoids coupling to Playwright internals.
- Both scripts must be run on `ubuntu-22.04` (or the Docker image matching CI) to produce portable baselines. Document this in `CONTRIBUTING.md` (task 13).

---

### Task 5 — Create the spec template and first spec (`scene.spec.ts`)

**Files:** `tests/visual/scene.spec.ts`

This is the canonical reference spec. All other per-demo specs follow this exact structure, varying only: demo ID, URL hash, interaction sequence, and (if needed) tolerance overrides.

```ts
/**
 * Visual regression spec: scene demo.
 *
 * Captures the canvas under backend='2d' (baseline) and backend='gl', then
 * asserts pixel diff ≤ 2%.
 *
 * Interaction sequence:
 *   1. Initial mount — capture static scene.
 *
 * If this demo has interactive controls that affect the canvas (e.g. buttons,
 * drag handles), add steps 2+ following the pattern below.
 */
import { test } from '@playwright/test';
import { resolve } from 'node:path';
import { captureCanvas, waitForRepaint, assertMatchesBaseline } from './diff.js';

const DEMO_ID = 'scene';
const BASELINE_DIR = resolve(import.meta.dirname, 'baselines');

// No per-demo tolerance override for this spec; 2d/gl pixel diff is expected
// to be well under 2% for solid-fill geometry.

test(`${DEMO_ID} — 2d baseline capture`, async ({ page }) => {
  const png = await captureCanvas(page, `/?backend=2d#${DEMO_ID}`);
  assertMatchesBaseline(png, resolve(BASELINE_DIR, `${DEMO_ID}-2d.png`));
});

test(`${DEMO_ID} — gl matches 2d baseline`, async ({ page }) => {
  const glPng = await captureCanvas(page, `/?backend=gl#${DEMO_ID}`);
  // Diff GL output against the committed 2D baseline.
  assertMatchesBaseline(glPng, resolve(BASELINE_DIR, `${DEMO_ID}-2d.png`));
});
```

**Verify this spec passes before writing the remaining 23.** Run:

```bash
npm run test:visual:update   # captures baselines/scene-2d.png
npm run test:visual -- --grep "scene"   # both tests should pass
```

---

### Task 6 — Per-demo interaction sequences

Each spec may need a scripted interaction before the final screenshot. The default (no interaction, just initial mount) is acceptable for demos that render a static scene. The table below specifies what each demo needs.

**Interaction template (add after `captureCanvas` initial mount):**

```ts
// Example: click a button, wait for repaint, capture again
await page.click('button[aria-label="Add card"]');
await waitForRepaint(page);
const png2 = await captureCanvas(page, '');  // '' = already on the page, re-screenshot
// ...or just take a second screenshot of the current page state:
const png2 = await page.locator('canvas').first().screenshot();
assertMatchesBaseline(png2, resolve(BASELINE_DIR, `${DEMO_ID}-2d-after-click.png`));
```

For the initial spec pass, use the simplest interaction that exercises the demo's primary rendered state. Do not attempt to replicate all possible states — one stable post-interaction screenshot per demo is sufficient.

**Recommended interaction sequences per demo (minimum viable):**

| Demo ID | Recommended interaction | Notes |
|---|---|---|
| `scene` | none | Static multi-layer scene |
| `move` | none | Items pre-placed; no drag needed for a stable screenshot |
| `animation` | click "Add card" button | Adds a node; wait for repaint |
| `easings` | none | Static easing curve display |
| `layout` | none | Static layout scene |
| `resize` | none | Static scene |
| `rotate` | none | Static scene |
| `insert` | none | Canvas starts empty; initial mount = empty canvas is valid baseline |
| `clone` | none | Pre-placed items |
| `text` | none | Static text nodes |
| `multi-select` | none | Pre-placed items |
| `actions` | none | Pre-placed items |
| `virtual-groups` | none | Pre-placed group tree |
| `nested-groups` | none | Pre-placed nested groups |
| `compose` | none | Pre-placed composited nodes |
| `quadtree` | none | Static quadtree visualization |
| `path-pose` | none | Pre-placed paths |
| `compound-paths` | none | Pre-placed compound path |
| `bezier-edit` | none | Pre-placed bezier with handles |
| `pixel-density` | none | Static pixel-density demo |
| `zoom` | none | Static initial zoom state |
| `viewport` | none | Static initial viewport with nodes |
| `debug-overlay` | none | Overlay rendered over static scene |
| `pan` | none | Static initial state |

Most demos render a pre-populated static scene that is deterministic on first paint. The "none" interactions above are intentional — the goal is to verify the GL backend paints the same pixels as 2D, not to exhaustively test each demo's interaction model.

**Exception: `insert` demo** starts with an empty canvas. For the baseline comparison to be meaningful, either: (a) accept an empty-canvas baseline (both 2D and GL paint the background color, which is still a valid pixel comparison), or (b) add a simulated drag via `page.mouse.down` / `page.mouse.move` / `page.mouse.up` to insert one rectangle. Prefer (b) for a non-trivial baseline. Document the choice in the spec file.

---

### Task 7 — Write specs for all 24 demos

**Files:** one `.spec.ts` per demo ID in `tests/visual/`

Follow the template from task 5 exactly. For each spec:

1. Copy `scene.spec.ts`.
2. Replace `DEMO_ID = 'scene'` with the target ID.
3. Add the interaction sequence from the table in task 6 (most are "none" = no changes needed).
4. If the demo requires a tolerance override, add a `const OPTS: DiffOptions` above the tests and pass it to `assertMatchesBaseline`. Always include a code comment explaining why the override is needed.

**Tolerance override example:**

```ts
// text demo: MSDF glyph sub-pixel rendering produces ~3% diff in anti-aliased
// edge regions between 2D and GL. GL output is visually correct; the extra
// tolerance accommodates the different AA algorithm.
const OPTS: DiffOptions = { maxDiffRatio: 0.05 };

test(`${DEMO_ID} — gl matches 2d baseline`, async ({ page }) => {
  const glPng = await captureCanvas(page, `/?backend=gl#${DEMO_ID}`);
  assertMatchesBaseline(glPng, resolve(BASELINE_DIR, `${DEMO_ID}-2d.png`), OPTS);
});
```

**Demos that are likely to require tolerance overrides:**
- `text` — MSDF AA vs Canvas 2D text AA differ at pixel level; expect ~3–5%.
- `compound-paths` — evenodd stencil rasterization may differ near winding boundaries.
- `bezier-edit` — sub-pixel stroke AA on curved handles.
- `pixel-density` — demo exists specifically to test DPR behavior; may be sensitive.

All others should pass at the default 2% if steps 1–8 are correct.

---

### Task 8 — Create `.github/workflows/visual.yml`

**Files:** `.github/workflows/visual.yml`

```yaml
name: Visual Regression

# Run on PRs and on main. Does NOT run on the node-matrix in ci.yml.
# CRITICAL: this workflow is pinned to ubuntu-22.04. Changing the runner
# image will corrupt all baseline PNGs — you must run test:visual:update
# in a matching environment and commit new baselines. See CONTRIBUTING.md.
on:
  pull_request:
  push:
    branches: [main]

jobs:
  visual-regression:
    # ⚠️  DO NOT change this runner without regenerating all baselines.
    # See docs/superpowers/specs/2026-05-08-webgl-transition-plan-design.md
    # "Visual regression rig → CI image pinning".
    runs-on: ubuntu-22.04

    steps:
      - uses: actions/checkout@v4

      - uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: npm

      - run: npm ci

      # Install Playwright browsers. The version is pinned by package-lock.json.
      - run: npx playwright install --with-deps chromium

      - name: Run visual regression tests
        run: npm run test:visual

      # On failure, upload diff artifacts so reviewers can inspect what changed.
      - name: Upload test results on failure
        if: failure()
        uses: actions/upload-artifact@v4
        with:
          name: visual-regression-results
          path: |
            tests/visual/baselines/
          retention-days: 14
```

**Important:** add this workflow to the required status checks in GitHub branch protection settings. Without that, the workflow runs but does not gate PRs. Document this in `CONTRIBUTING.md`.

> **Why not extend `ci.yml`?** `ci.yml` runs on `ubuntu-latest`, which is a floating tag. Adding a `runs-on: ubuntu-22.04` job to `ci.yml` would create an inconsistency in the same file and risk confusion about which jobs are image-pinned. A separate file with its own explicit header comment keeps the constraint visible and auditable.

---

### Task 9 — Verify all 24 specs pass under `backend='2d'` (baseline capture)

This task is the first stage of the soak procedure. Run on `ubuntu-22.04` (local Docker image or CI — see §Soak procedure below).

```bash
# Capture all 2D baselines:
npm run test:visual:update

# Verify all 24 specs assert-pass against the captured baselines:
npm run test:visual
```

Expected: 24 × 2 tests = 48 tests pass (the "2d baseline capture" and "gl matches 2d baseline" for each demo — but at this point the GL test will FAIL for all 24 demos because the GL renderer is not yet wired to the demo app). That is expected. The goal of this task is:
- All 24 `<demo-id> — 2d baseline capture` tests pass.
- All 24 `<demo-id>.png` baselines are committed.

**Do not commit GL-failing tests as green.** The GL tests are expected to fail until task 10.

---

### Task 10 — Soak: switch demos to `backend='gl'` one at a time

See the dedicated §Soak procedure section below for the full walkthrough. This task is the iterative loop: for each demo, drive it under GL, measure the diff, iterate on the GL renderer until ≤ tolerance, commit.

The task is complete when all 24 GL tests pass (all `<demo-id> — gl matches 2d baseline` tests green in CI on `ubuntu-22.04`).

---

### Task 11 — Harden `ci.yml` bundle-size gate

**Files:** `.github/workflows/ci.yml`

The spec (§ Risks & rollback) calls for a CI step that "fails if delta > 50KB without a CHANGELOG entry." This was documented as non-failing in step 1. Step 9 is the designated landing point for making it hard.

Add a step to the `test` job in `ci.yml` that:
1. Runs `npm run bundlesize:weasel-gl` and captures the byte count.
2. Compares against a committed baseline size (store as `packages/weasel-gl/.bundle-size-baseline` — a plain text file with the byte count).
3. Fails if `current - baseline > 51200` (50 KB) AND no `CHANGELOG.md` entry for the current commit SHA exists.

Simpler acceptable alternative: fail if delta > 50 KB unconditionally, and require the developer to update the baseline file as part of any large-bundle PR. This avoids the CHANGELOG-coupling complexity.

```yaml
- name: Assert weasel-gl bundle size delta
  run: |
    CURRENT=$(npm run bundlesize:weasel-gl --silent 2>&1 | grep -oP '\d+(?= bytes)')
    BASELINE=$(cat packages/weasel-gl/.bundle-size-baseline 2>/dev/null || echo 0)
    DELTA=$((CURRENT - BASELINE))
    echo "Bundle size: ${CURRENT} bytes (baseline: ${BASELINE}, delta: ${DELTA})"
    if [ "$DELTA" -gt 51200 ]; then
      echo "ERROR: bundle grew by ${DELTA} bytes (> 50KB limit)."
      echo "Update packages/weasel-gl/.bundle-size-baseline if this is intentional."
      exit 1
    fi
```

Capture the initial baseline:
```bash
npm run bundlesize:weasel-gl | grep -oP '\d+(?= bytes)' > packages/weasel-gl/.bundle-size-baseline
git add packages/weasel-gl/.bundle-size-baseline
```

---

### Task 12 — Update `demo/main.tsx` (or `CanvasKitDemo.tsx`) to read `?backend=`

This is the same as task 1 but split out because the exact implementation depends on how step 8 wired the `backend` prop. The concrete implementation steps are:

- [ ] Confirm step 8's `backend` prop is on `<SceneCanvas>` (not on `<Canvas>` only).
- [ ] Add `BackendContext` in `demo/` (see task 1 for the recommended context approach).
- [ ] Wrap the root render in `demo/main.tsx` with `<BackendProvider>`.
- [ ] In `BackendProvider`, read `new URLSearchParams(window.location.search).get('backend')`.
- [ ] Each demo that uses `<SceneCanvas>` consumes `const backend = useContext(BackendContext)` and passes it as `<SceneCanvas backend={backend} ...>`.
- [ ] Demos that do not use `<SceneCanvas>` (if any) are unaffected.

> This task may already be done as part of step 8. If step 8 implemented the `?backend=` query string itself, skip this task and verify it works as expected.

---

### Task 13 — Update `CONTRIBUTING.md`

**Files:** `CONTRIBUTING.md` (create if it does not exist)

Add a section:

```markdown
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
```

---

## Soak procedure

This section describes the full iterative process for completing task 10 (switching all demos from 2D to GL without exceeding the 2% pixel diff threshold).

### Prerequisites

- All 24 `backend='2d'` baselines are committed (task 9 complete).
- All 24 `<demo-id> — 2d baseline capture` tests pass in CI.

### Process

Work through demos one at a time. The recommended order is simplest-to-hardest:

**Tier 1 — solid geometry, no text or gradients (expected < 1% diff):**
`scene`, `move`, `resize`, `rotate`, `insert`, `clone`, `multi-select`, `actions`, `virtual-groups`, `nested-groups`, `groups`, `pan`, `zoom`, `viewport`

**Tier 2 — strokes, compound paths, group effects:**
`compose`, `path-pose`, `compound-paths`, `bezier-edit`, `debug-overlay`, `quadtree`

**Tier 3 — text, animations, gradients (highest risk):**
`text`, `animation`, `easings`, `layout`, `pixel-density`

For each demo:

```
1. Navigate to /?backend=gl#<demo-id> manually in a browser.
   Eyeball: does it look approximately correct?
   If it looks wildly wrong (blank canvas, wrong colors, missing geometry):
     → File a bug against the GL renderer; do not proceed until the renderer
       is fixed. This plan is a quality gate, not a workaround factory.

2. Run: npm run test:visual -- --grep "<demo-id>"
   Check the reported diff ratio.

3. If diff ≤ 2% (or ≤ per-demo override): DONE. Move to next demo.

4. If diff is 2–5%:
   a. Inspect the pixelmatch diff visually (add diffOutputPath to the
      assertMatchesBaseline call temporarily to write the diff PNG).
   b. Identify the affected region (AA edges, gradients, text, etc.).
   c. If the diff is in genuine subpixel AA regions (not a rendering bug):
      raise the per-demo tolerance with a code comment justification.
   d. If it is a rendering bug: fix the renderer; re-run.

5. If diff is > 5%:
   Do not raise the tolerance above 5%. Instead:
   a. File a bug against the specific GL renderer feature.
   b. Leave the demo on backend='2d' for the time being.
   c. Track in a "GL pending" list; revisit after the renderer fix lands.

6. Once a demo passes: commit its passing GL test and any tolerance override.
```

### Convergence criteria

All 24 demos must have their `— gl matches 2d baseline` test passing in CI (`ubuntu-22.04`) before flipping the default `backend` to `'gl'`. No demo is allowed to be skipped via `test.skip` — if a demo can't converge, its GL renderer issue is a blocker.

### Flipping the default

Once all 24 GL tests pass:

1. In `BackendContext` (or wherever the `?backend=` default is set), change the default from `'2d'` to `'gl'`.
2. Deploy to the published demo site (triggers via `pages.yml` on merge to main).
3. Start the 30-day soak clock. File a tracking issue: "Step 9 soak: 30 days of GL default".
4. If a regression bug is filed against the published demo within 30 days: investigate and fix before proceeding to step 10. If the fix is in the GL renderer, re-run the full visual suite and update baselines if needed. Do NOT proceed to step 10 with outstanding regression bugs.
5. After 30 days without a regression bug: step 9 is complete. Step 10 may begin.

### What to do when a diff doesn't converge

Some diffs are real GL/2D rendering differences that are not bugs — they are expected consequences of different rendering algorithms (e.g. MSDF text AA vs Canvas 2D text AA). These should be accepted at a documented tolerance. Use this checklist:

- [ ] Is the diff in anti-aliased edges only (1–2 pixel fringe)? → Accept at 3–5% with a comment.
- [ ] Is the diff in gradient ramp interpolation? → Verify the ramp texture matches CSS color stops. If it matches, accept.
- [ ] Is the diff in sub-pixel text positioning? → Check vertical metrics (`yoffset`, `base`). Accept up to 4% for text demos.
- [ ] Is the diff in large solid regions? → This is a real bug. Do not accept.
- [ ] Is the diff in alpha blending (translucent fills)? → Verify premultiplied output convention (§2 from `webgl-stepwise-conventions.md`). Fix the shader.
- [ ] Is the canvas entirely wrong (wrong background, wrong colors)? → Real bug. Do not accept.

---

## Deferred — out of scope for step 9

### Animation frame-by-frame visual diff

`animation.spec.ts` captures the initial mount and a post-click state. It does NOT capture individual animation frames (e.g. a tweened position at t=0.5). Frame-by-frame motion diff requires deterministic animation timing (seeded RAF, fixed frame timestamps) which is its own subproject. Deferred.

### Cross-platform pixel comparison

Baselines are pinned to `ubuntu-22.04` + headless Chromium. macOS and Windows produce different pixels due to different font rasterization, sub-pixel AA, and GPU-side compositing. Cross-platform comparison is explicitly not a goal of this rig.

### Real-device performance measurement

Perf measurement (FPS, draw call counts, GPU memory) is not a visual regression concern. Separate harness if/when needed.

### Safari / Firefox baseline parity

The rig uses Chromium exclusively. Different browser rendering engines produce different pixels even for the same HTML/CSS/WebGL input. Adding Safari/Firefox baselines would require runner images with those browsers installed and separate baseline sets. Deferred; the CI rig tests correctness in Chromium, which is sufficient for the soak gate.

### Diffing in PR comments

Automatically posting diff images as PR comments (e.g. via `actions/upload-artifact` + a bot comment) would improve review UX but requires additional workflow infrastructure. Deferred; the artifact upload on failure (task 8) is sufficient for now.

---

## Conventions checklist (from `webgl-stepwise-conventions.md`)

All entries apply. Specific task callouts:

- **§1 (browser context defaults):** `captureCanvas()` uses `canvas.screenshot()`, not `gl.readPixels`. No `preserveDrawingBuffer` needed. But if any spec ever needs pixel-exact color values (not just PNG diff), add a note here — it would need `preserveDrawingBuffer: true` on the demo page.
- **§2 (premultiplied alpha):** If a GL demo shows too-bright translucent fills vs the 2D baseline, check the fragment shader's premultiplication. The diff will show a large bright halo around semi-transparent objects.
- **§3 (--save-exact):** No new deps. Both `@playwright/test` and `pixelmatch` are already exact-pinned in `package.json`.
- **§6 (preserveDrawingBuffer):** Not needed for `canvas.screenshot()`. Retained here for reference.
- **§7 (inline verbatim tasks):** Tasks 2, 3, 4, 8 are verbatim — the controller should inline these. Tasks 9, 10, 12, 13 require judgment.
- **§9 (per-renderer state):** Applies to the GL demos: if a demo uses `registerFont` or `registerTexture`, verify the second renderer (after context loss or hot-reload) re-uploads correctly. The visual test provides an indirect check.
- **§1 update (grid sampling):** Not applicable — `canvas.screenshot()` captures the full PNG. No sampling decisions needed.

---

## Task summary

| # | Task | Type | Notes |
|---|---|---|---|
| 1 | Wire `?backend=` query string in demo app | Judgment | Depends on step 8; may already be done |
| 2 | Create `tests/visual/playwright.config.ts` | Verbatim | Copy from plan |
| 3 | Create `tests/visual/diff.ts` | Verbatim | Copy from plan |
| 4 | Add npm scripts | Verbatim | 2 lines in `package.json` |
| 5 | First spec (`scene.spec.ts`) + smoke-verify | Verbatim + verify | Template for all others |
| 6 | Per-demo interaction table | Reference | See task 6 table; no code |
| 7 | Write 23 remaining specs | Verbatim (×23) | One per demo; follow template |
| 8 | Create `.github/workflows/visual.yml` | Verbatim | Copy from plan |
| 9 | Capture 2D baselines, verify all pass | Soak (2D) | Must run on ubuntu-22.04 |
| 10 | Switch demos to GL one at a time | Soak (GL) | Iterative; see §Soak procedure |
| 11 | Harden bundle-size gate in `ci.yml` | Verbatim + verify | Non-failing gate becomes hard |
| 12 | Confirm / implement `?backend=` wiring | Judgment | Depends on step 8 implementation |
| 13 | Update `CONTRIBUTING.md` | Verbatim | Copy from plan |
| 14 | Flip default `backend` to `'gl'` | 1 line | After all GL tests green |
| 15 | Start 30-day soak clock | Process | File tracking issue; monitor demo site |
| 16 | Exit soak; unblock step 10 | Process | 30 days clean → close tracking issue |

**Total: 16 tasks.** Tasks 1–8 are rig setup (≈ 1 session). Tasks 9–10 are the iterative soak (may span multiple sessions). Tasks 11–16 are closure.

---

## Exit criterion (from spec)

> Every demo passes visual diff under `backend='gl'` against its 2D baseline. 30 days of `'gl'` default in the published demo site without a regression bug filed.

Step 10 (final 2D deletion) cannot start before this criterion is met.
