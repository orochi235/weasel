All six findings were real and are fixed, one commit each with a changeset. Every check below passes.

- insertPreview `extras` missing or not an object throws (B) — fixed 2a604f3170
- Main canvas cull ignores a pose override's `path`, unlike the scene view (B) — fixed 0c3cf2d7bc. Both culls now go through one shared `sceneCullPaintBounds`, so they can't differ again.
- `<Canvas>` keeps the replaced `<canvas>` registered after a `worker` toggle (B) — fixed 944b52d573. The registration now follows whatever element the canvas currently has, checked at every commit.
- `<SceneViewCanvas>` has no `redrawOn`, so an `alphaFor` that reads outside state goes stale (A) — fixed 73ecc2e7a0. It's added to both the page path and the worker path. This is new API, so the changeset is `minor`.
- `watchThemeOf` misses token overrides set inline or in a stylesheet in `<head>` (A) — fixed 2812d9884a. It now hears:
  - an inline `style` above the canvas, only when its custom properties change (a per-frame transform doesn't fire it);
  - a `<style>` or `<link>` in `<head>` being added, removed or rewritten, or a `<link>`'s `href`/`media`/`disabled` changing.

  Rules changed through the CSSOM (`insertRule`, `adoptedStyleSheets`) and a `<link>` finishing its load still aren't heard; the doc comment says so.
- A tile of a canvas already painting with WebGPU builds a WebGPU renderer and erases its co-tenants (A) — fixed 0352750911. The tile now gets no renderer and warns once. I kept this refusal separate from the canvas's general refused state, so the canvas can still paint whole. No `docs/unruled.md` entry: this enforces what the `CanvasBackend` doc already promises.

No extra defects found while fixing.

Checks:
- Each touched test file, run alone with `--maxWorkers=1`: pass. That's `insertPreviewExtent.test.ts` (5), `overridePath.test.ts` (14), `Canvas.mountedCanvases.test.tsx` (2), `SceneViewCanvas.test.tsx` (18), `renderWorker/WorkerSceneView.test.tsx` (4), `accentColor.test.ts` (6), `canvasBackend.test.ts` (3), `canvasRenderer.webgpu.test.ts` (2), plus `buildSceneLayer.cull.test.ts` (9) and `mountedCanvases.test.ts` (1). Each new test failed before its fix.
- `npm run checks:gate`: "checks:gate: all 32 passed". The first run failed two steps: `check:changesets` (two titles over 140 characters) and `lint` (a `weasel/effect-cleanup` error in `mountedCanvases.ts`). I fixed both into their commits and the rerun passed.
- `npm run lint -w @weasel-js/core`: fail, "Missing script: "lint"". The core package has no lint script, so the root `npm run lint` inside the gate covers it, and that passed.
- No browser tests were touched. The tree is clean and `.skulk/` is untouched.