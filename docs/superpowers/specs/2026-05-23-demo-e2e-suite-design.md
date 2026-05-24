# Demo end-to-end test suite

## Problem

Demo regressions ship undetected. The existing `demo/demos/__tests__/*.integration.test.tsx` files run in jsdom, which can't exercise real pointer input or canvas rendering. The existing `tests/visual/*.spec.ts` Playwright suite mounts each demo and asserts a pixel baseline, but does not drive any gestures — so interaction breaks (e.g. a tool that no longer translates an item, a wheel zoom that loses its anchor point) only surface when a human notices the demo is broken.

We need a third suite that drives demos with real input in a real browser, asserts on structured scene state, and catches runtime errors.

## Goals

- Catch interaction regressions in core gestures (move, path edit, viewport math) before they reach a release.
- Catch runtime errors / unhandled rejections that fire during a gesture but don't show up at mount.
- Stay structural: assertions read scene/view/selection state, not pixels, except where the outcome is inherently visual.
- Be a pattern that scales to all ~40 demos. Land the pattern with 3 pilots; expansion is a follow-up.

## Non-goals

- No CI wiring in the first pass. Suite runs locally on demand.
- No replacement for the existing `tests/visual/` suite — pixel baselines for static mounts stay where they are.
- No replacement for `demo/demos/__tests__` integration tests — they stay for cheap DOM-level checks.

## Layout

```
tests/e2e/
  playwright.config.ts        # own project, own port, own retries policy
  fixtures.ts                 # `demo` fixture (see §4)
  helpers/
    coords.ts                 # scene-coord ↔ CSS-pixel translation
    snapshot.ts               # thin re-export of tests/visual/diff.ts for optional pixel checks
  move.spec.ts                # pilot
  bezier-edit.spec.ts         # pilot
  zoom.spec.ts                # pilot
  baselines/                  # only populated if a pilot needs a visual gate
```

- Vite dev server runs on port **5175** (5173 = smoke, 5174 = visual, 5175 = e2e). All three Playwright projects can run in parallel without colliding.
- npm script: `test:e2e:demos` → `playwright test --config=tests/e2e/playwright.config.ts`.
- `retries: 0` locally; allow `retries: 1` if/when the suite moves to CI (interaction tests have more legitimate flake surfaces than visual ones).
- `workers: undefined` (Playwright default) — specs are independent, no shared baseline state, can run in parallel.

## Kit test hook

A single opt-in introspection surface, attached to `window` only when the page URL contains `test=1`. Lives in a new internal module wired into `SceneCanvas` so every demo inherits it.

```ts
// src/test-hook/index.ts  (internal, not exported from the package entrypoint)
export interface WeaselTestHook {
  ready: Promise<void>;                  // resolves once SceneCanvas has mounted and rendered once
  getScene(): SerializedSceneSnapshot;   // structural snapshot: items, layers, poses, ids
  getSelection(): string[];              // selected item ids
  getView(): { x: number; y: number; zoom: number };
  getActiveToolId(): string | null;
  probe<T = unknown>(name: string): T | undefined;
  registerProbe<T>(name: string, fn: () => T): () => void;  // returns disposer
}

declare global {
  interface Window { __weaselTest?: WeaselTestHook }
}
```

### Gating

- `SceneCanvas` checks `new URLSearchParams(location.search).has('test')` on mount.
- If set, it constructs the hook and assigns to `window.__weaselTest`. If not, the hook module is tree-shakable and never touched.
- Behind the same gate, `import.meta.env.DEV` must also be true OR the bundle must be the demo bundle — the hook **never** attaches in a consumer's production bundle. Implementation detail to nail down in the plan: probably a `if (import.meta.env.MODE !== 'production')` guard outside the URL check, since the published kit bundle is built in production mode.

### Per-demo extensions

A demo that needs richer introspection (e.g. bezier handle positions) registers a probe in a `useEffect`:

```ts
useEffect(() => {
  return window.__weaselTest?.registerProbe('handles', () => readHandlesFromScene(sceneRef.current));
}, []);
```

The fixture then exposes `demo.probe<HandleSnapshot>('handles')`. Demos that need nothing don't change.

## Spec structure & fixture

Each spec navigates, drives input, asserts on structured state. The `demo` fixture handles the boring parts.

```ts
// tests/e2e/move.spec.ts
import { test, expect } from './fixtures.js';

test('move — drag translates the selected item by gesture delta', async ({ demo }) => {
  await demo.goto('move');
  const [item] = demo.getScene().items;
  await demo.dragScene({ from: item.pose.center, by: [80, 40] });
  const after = demo.getScene().items.find(i => i.id === item.id)!;
  expect(after.pose.center[0] - item.pose.center[0]).toBeCloseTo(80, 0);
  expect(after.pose.center[1] - item.pose.center[1]).toBeCloseTo(40, 0);
});
```

The fixture (`tests/e2e/fixtures.ts`) provides:

| Method | Purpose |
|---|---|
| `goto(demoId)` | Navigates to `/?test=1#${demoId}`, awaits `window.__weaselTest.ready`. |
| `getScene() / getSelection() / getView() / getActiveToolId() / probe(name)` | Thin wrappers around `page.evaluate(() => window.__weaselTest.X())`. Cached per call site, not memoized. |
| `dragScene({ from, to? \| by? })` | Scene-coord drag. Translates to CSS pixels via current `getView()` and the canvas bounding rect. Uses `page.mouse` (move → down → moves → up). |
| `clickScene(point, opts?)` | Single click at a scene point. |
| `wheelZoom({ at, dz })` | Wheel event at a scene point with a deltaY. |
| `key(key, opts?)` | Convenience around `page.keyboard.press`. |
| `snapshot(name)` | Optional end-state pixel diff via `tests/visual/diff.ts`; baselines under `tests/e2e/baselines/`. Only used when the assertion is genuinely visual. |
| `expectConsoleError(re)` | Allowlist a single console error for negative tests. |

The fixture auto-installs `console` and `pageerror` listeners; any unallowed error fails the test at teardown. This is the "free" runtime-error gate — every spec inherits it without writing assertions.

## Pilots

Three demos, chosen because they stress maximally different surfaces. If the fixture handles all three cleanly, the pattern generalizes.

### `move.spec.ts`

- **Drives:** drag an item by (Δx, Δy) from its center.
- **Asserts:** scene snapshot shows the same item id with `pose.center` translated by (Δx, Δy) within 1px; selection contains the dragged item; no console errors.

### `bezier-edit.spec.ts`

- **Drives:** activate a vertex, then drag one of its handles by (Δx, Δy).
- **Asserts:** via `probe('handles')` (registered by the demo), the dragged handle position updated by (Δx, Δy); the mirrored handle reflected (if mirroring is on); the anchor point itself did **not** move; no console errors.
- **Note:** bezier-edit must register a `handles` probe — a small demo touch (~5 lines).

### `zoom.spec.ts`

- **Drives:** dispatch a wheel event with a known `deltaY` at scene point P.
- **Asserts:** `getView().zoom` increased monotonically; the scene point P remains under the cursor's CSS position within 1px after zoom (the "anchor invariant" — historically the most-regressed property of zoom).

## Failure-mode coverage

The user's three top failure modes from brainstorming:

| Failure mode | How this suite catches it |
|---|---|
| Interaction breaks | Structural assertion on scene/view state after a driven gesture. |
| Runtime errors / console | Fixture-level `console` + `pageerror` listener fails any spec with an unallowed error. |
| Visual regressions | Already covered by `tests/visual/`. This suite uses `snapshot()` only when an interaction's outcome is inherently visual; otherwise relies on structural checks. |

## Out of scope

- CI wiring — local-only first. Wire to CI after the suite has been green for a week on `main`.
- Expansion past the three pilots — separate follow-up plans, one per cluster (core gestures / path edit / viewport).
- A public test-hook API — the hook is `@internal`, demo-only, gated by URL param + non-production build. Consumers don't see it.
- Test-data fixtures — pilots use whatever the demos already render.

## Open questions

1. **Production-bundle guard for the hook.** The URL-param gate prevents accidental attachment in dev, but we must also be certain `window.__weaselTest` cannot exist in a consumer's production build of the kit. Likely solution: gate on `import.meta.env.MODE !== 'production'` *and* the URL param, plus a build-time assertion. Pin this down in the plan.
2. **Coordinate translation under transformed viewports.** `dragScene` needs to project scene → CSS pixels through `getView()` plus any CSS transforms on the canvas wrapper. If the canvas has `transform: scale(...)` on it (some demos do), the math gets less trivial. The plan should include a unit test for `coords.ts`.

## Definition of done

- `tests/e2e/` exists with the three pilot specs, fixture, helpers, and config.
- `npm run test:e2e:demos` runs the suite locally and all three pilots pass.
- The kit exposes `window.__weaselTest` under the gated conditions and nowhere else.
- A short "Adding a demo to the e2e suite" section is added to `docs/TODO.md` or a sibling doc, pointing at the pilots as templates.
