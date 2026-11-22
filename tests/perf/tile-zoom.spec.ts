/**
 * A zoom over a static backdrop of 100k nodes in one scene layer, drawn live (culled) against the
 * same layer kept as a tile pyramid. A scripted path zooms from fit-all to 64x and back over 600
 * frames, then pans 200. Every frame records its time (drawLayers, render and a gl.finish), and for
 * the tiled layer the tiles baked, the bake time, the stand-ins drawn, how often the layer was drawn
 * live, and the bytes its tiles hold. Every raw record is kept.
 *
 *   onto do --kind bench --gui -- npx playwright test --config tests/perf/playwright.config.ts tile-zoom
 *
 * `WEASEL_PERF_ZOOM_FRAMES` shortens the zoom. This reports; it does not gate.
 */
import { test, expect } from '@playwright/test';
import { isolate } from './lib/isolate';
import { metric, startRun } from './lib/result';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const W = 1280;
const H = 800;
const DPR = 2;
const ZOOM = Number(process.env.WEASEL_PERF_ZOOM_FRAMES) || 600;
const PAN = 200;

interface FrameRecord { ms: number; baked: number; bakeMs: number; standIns: number; liveDraws: number; bytes: number; held: number }

test.setTimeout(3_600_000);

test('a zoom over a tiled backdrop against the same layer drawn live', async ({ page, browser, browserName }) => {
  const run = startRun('tile-zoom', { viewport: `${W}x${H}`, dpr: DPR, zoomFrames: ZOOM, panFrames: PAN, nodes: 100_000 });
  const errors: string[] = [];
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push(m.text());
    else if (m.text().startsWith('tile-zoom')) console.log(m.text());
  });
  page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`));
  await isolate(page);
  await page.goto('/weasel/#animation');
  await page.waitForSelector('canvas');
  // The first import of these modules can make the dev server optimize a dependency and reload
  // the page: import them once, let any reload land, and start again on a settled page.
  const warm = async () => page.evaluate(async (root) => {
    const base = `/weasel/@fs${root}/packages/core/src`;
    await Promise.all(['core/layers/tileHost.ts', 'core/scene/scene.ts', 'canvas/buildSceneLayer.ts', 'canvas/sceneSlotWiring.ts',
      'canvas/sceneAdapter.ts', 'canvas/defaultDrawOne.ts', 'core/layers/render.ts'].map((m) => import(/* @vite-ignore */ `${base}/${m}`)));
  }, repoRoot);
  await warm().catch(() => {});
  await page.waitForTimeout(3000);
  await page.goto('/weasel/#animation');
  await page.waitForSelector('canvas');
  await warm();

  const out = await page.evaluate(async ({ root, w, h, dpr, zoom, pan }) => {
    const base = `/weasel/@fs${root}/packages/core/src`;
    const { WeaselRenderer } = await import(/* @vite-ignore */ `/weasel/@fs${root}/packages/renderer/src/index.ts`);
    const { drawLayers } = await import(/* @vite-ignore */ `${base}/core/layers/render.ts`);
    const { createTileHost } = await import(/* @vite-ignore */ `${base}/core/layers/tileHost.ts`);
    const { createScene } = await import(/* @vite-ignore */ `${base}/core/scene/scene.ts`);
    const { buildSceneLayers } = await import(/* @vite-ignore */ `${base}/canvas/buildSceneLayer.ts`);
    const { wireSceneSlotToScene } = await import(/* @vite-ignore */ `${base}/canvas/sceneSlotWiring.ts`);
    const { sceneToAdapter } = await import(/* @vite-ignore */ `${base}/canvas/sceneAdapter.ts`);
    const { defaultDrawOne, defaultPaintBounds } = await import(/* @vite-ignore */ `${base}/canvas/defaultDrawOne.ts`);

    const side = 316, pitch = 10;
    const initial = [];
    for (let i = 0; i < side * side; i++) {
      const x = (i % side) * pitch, y = Math.floor(i / side) * pitch;
      initial.push({
        id: `n${i}`, kind: 'mark', layer: 'main', pose: { x, y, width: 6, height: 6 },
        data: { fill: { paint: { kind: 'solid', color: `rgb(${(i * 37) % 256}, ${(i * 11) % 256}, 160)` } } },
      });
    }
    const scene = createScene({ systemLayers: [{ id: 'main' }], historyLimit: 1, initial });
    const extent = side * pitch;
    const fit = Math.min(w, h) / extent;
    const viewAt = (f: number) => {
      const t = f < zoom ? (f < zoom / 2 ? f / (zoom / 2) : (zoom - f) / (zoom / 2)) : 0.5;
      const s = fit * 64 ** t;
      const panned = f < zoom ? 0 : (f - zoom) * 4 / s;
      const cx = extent / 2 + panned, cy = extent / 2;
      return { x: cx - w / 2 / s, y: cy - h / 2 / s, scale: { x: s, y: s } };
    };

    const runVariant = (tiled: boolean) => {
      const canvas = document.createElement('canvas');
      canvas.width = w * dpr;
      canvas.height = h * dpr;
      const gl = canvas.getContext('webgl2', { stencil: true });
      if (!gl) throw new Error('no WebGL2');
      const dbg = gl.getExtension('WEBGL_debug_renderer_info');
      const glRenderer = String(dbg ? gl.getParameter(dbg.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER));
      const renderer = new WeaselRenderer({ gl, canvas, width: w, height: h, dpr });
      const slot = { drawOne: defaultDrawOne, paintBounds: defaultPaintBounds, cull: true, ...(tiled ? { tiles: { main: { fadeMs: 0 } } } : {}) };
      const wired = wireSceneSlotToScene(slot, scene);
      const layers = buildSceneLayers(wired, sceneToAdapter(scene), () => null, () => null).map((l: { layer: unknown }) => l.layer);
      const host = tiled ? createTileHost(renderer.tiles) : undefined;
      const records = [];
      const dims = { width: w, height: h, dpr };
      for (let f = 0; f < zoom + pan; f++) {
        const view = viewAt(f);
        const t0 = performance.now();
        const cmds = drawLayers(layers, null, {}, undefined, view, dims, new Map(), undefined, undefined, undefined, false, host);
        renderer.render(cmds, new Float32Array([view.scale.x, 0, 0, 0, view.scale.y, 0, -view.x * view.scale.x, -view.y * view.scale.y, 1]));
        gl.finish();
        const ms = performance.now() - t0;
        const st = host?.stats() ?? { baked: 0, bakeMs: 0, standIns: 0, liveDraws: 1, bytes: 0, held: 0 };
        records.push({ ms, ...st });
        if (f % 100 === 0) console.log(`tile-zoom ${tiled ? 'tiled' : 'live '} ${f}/${zoom + pan} ${ms.toFixed(2)} ms`);
      }
      renderer.dispose();
      gl.getExtension('WEBGL_lose_context')?.loseContext();
      return { glRenderer, records };
    };
    const live = runVariant(false);
    const tiled = runVariant(true);
    return { glRenderer: live.glRenderer, live: live.records, tiled: tiled.records };
  }, { root: repoRoot, w: W, h: H, dpr: DPR, zoom: ZOOM, pan: PAN });

  expect(errors, `page errors:\n${errors.join('\n')}`).toEqual([]);
  run.machine({ glRenderer: out.glRenderer, browser: `${browserName} ${browser.version()}` });
  const med = (xs: number[]) => [...xs].sort((a, b) => a - b)[Math.floor(xs.length / 2)]!;
  const p95 = (xs: number[]) => [...xs].sort((a, b) => a - b)[Math.floor(xs.length * 0.95)]!;
  // The frames after the floor is in: the first frame bakes it.
  const tiledAfter = (out.tiled as FrameRecord[]).slice(1);
  const live = out.live as FrameRecord[];
  run.item('live', {
    medianMs: metric(med(live.map((r) => r.ms)), 'ms', 'median frame, drawLayers + render + gl.finish', live.map((r) => r.ms)),
    p95Ms: metric(p95(live.map((r) => r.ms)), 'ms', '95th percentile frame'),
  });
  run.item('tiled', {
    medianMs: metric(med(tiledAfter.map((r) => r.ms)), 'ms', 'median frame after the first, drawLayers + bakes + render + gl.finish', tiledAfter.map((r) => r.ms)),
    p95Ms: metric(p95(tiledAfter.map((r) => r.ms)), 'ms', '95th percentile frame after the first'),
    liveDraws: metric(tiledAfter.reduce((a, r) => a + r.liveDraws, 0), 'count', 'frames after the first that drew the layer live'),
    baked: metric(tiledAfter.reduce((a, r) => a + r.baked, 0), 'count', 'tiles baked after the first frame', tiledAfter.map((r) => r.baked)),
    bakeMs: metric(med(tiledAfter.filter((r) => r.baked > 0).map((r) => r.bakeMs)), 'ms', 'median CPU bake time of a frame that baked', tiledAfter.map((r) => r.bakeMs)),
    standIns: metric(tiledAfter.reduce((a, r) => a + r.standIns, 0), 'count', 'stand-in quads drawn', tiledAfter.map((r) => r.standIns)),
    peakBytes: metric(Math.max(...tiledAfter.map((r) => r.bytes)), 'bytes', 'most GPU memory the tiles held', tiledAfter.map((r) => r.bytes)),
  });
  console.log(`tile-zoom: live median ${med(live.map((r) => r.ms)).toFixed(2)} ms, p95 ${p95(live.map((r) => r.ms)).toFixed(2)}`
    + `; tiled median ${med(tiledAfter.map((r) => r.ms)).toFixed(2)} ms, p95 ${p95(tiledAfter.map((r) => r.ms)).toFixed(2)},`
    + ` live draws ${tiledAfter.reduce((a, r) => a + r.liveDraws, 0)}, peak ${(Math.max(...tiledAfter.map((r) => r.bytes)) / 2 ** 20).toFixed(1)} MiB`);
  run.write();
});
