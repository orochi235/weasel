# tests/e2e — interaction-driven demo tests

Each spec navigates to a demo with `?test=1`, drives real input via Playwright, and asserts on scene/view/probe state read from `window.__weaselTest`. Complements `tests/visual/` (mount-and-snapshot pixel baselines) and `demo/demos/__tests__/` (jsdom integration tests).

## Run

```bash
npm run test:e2e:demos
# or filter to one spec:
npm run test:e2e:demos -- move.spec.ts
# or interactive:
npm run test:e2e:demos -- --debug
```

## How the test hook works

`SceneCanvas` attaches `window.__weaselTest` when the page URL contains `?test=1` AND the build is non-production. The hook exposes:

- `ready` — promise that resolves once the canvas has rendered.
- `getScene()` — serialized scene snapshot (items, layers, poses).
- `getSelection()` — array of selected node ids.
- `getView()` — current viewport `{ x, y, scale: { x, y } }`.
- `getActiveToolId()` — current tool id, or `null`.
- `probe(name)` — read a demo-registered probe value.
- `registerProbe(name, fn)` — demos register custom probes for state outside the scene.

The hook is fully tree-shaken from consumer production builds via a call-site `process.env.NODE_ENV !== 'production'` guard in `SceneCanvas.tsx`. Verified by inspecting `dist-demo/` after `npm run build:demo` — 0 matches for `installTestHookIfRequested`.

## Add a demo

1. Pick the demo's hash id (e.g. `move`, `bezier-edit`).
2. Choose the smallest, most structural assertion:
   - Scene snapshot (`demo.getScene()`) — for anything mutating the scene.
   - View (`demo.getView()`) — for viewport gestures.
   - Selection (`demo.getSelection()`) — for selection behavior.
   - A demo-registered probe (`demo.probe('name')`) — for demo-local state. Register inside the demo with `window.__weaselTest?.registerProbe`.
3. Copy `move.spec.ts` as a template.
4. Run it: `npm run test:e2e:demos -- yourdemo.spec.ts`.

The fixture (`fixtures.ts`) auto-fails the test on any console/page error. Allowlist expected errors with `demo.expectConsoleError(/regex/)` for negative tests.

## Why this is separate from `tests/visual/`

`tests/visual/` has a strict pixel-baseline contract: serial workers, fixed viewport, 0 retries, baselines committed to git. Mixing interaction-driven tests in would muddy those baselines. The two suites run on different ports (5174 visual, 5175 e2e) so they can run in parallel.

## Pilots and what they exercise

| Spec | Demo | What it catches |
|---|---|---|
| `move.spec.ts` | move | Selection + drag → setPose op flow, snap-to-grid. |
| `zoom.spec.ts` | zoom | Wheel-zoom anchor invariant — the canvas-local cursor point stays under the cursor after zoom. (Caught a real regression where the dispatcher fed viewport coords instead of canvas-local coords into `zoomAt`.) |
| `bezier-edit.spec.ts` | bezier-edit | Path serialization round-trip via the demo's `handles` probe; the Add-point button extends the path with a new cubic. Per-handle drag is not yet a supported gesture in this demo — the probe is ready for that spec once `editAnchorsAction` is wired. |
