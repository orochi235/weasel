/**
 * What N renderers on one context cost. Mesh, texture and gradient-ramp caches
 * are per-renderer, so two panes drawing the same shapes hold two copies of
 * every uploaded mesh and glyph atlas on the same GL context. The spec's open
 * question is whether that duplication beats re-targeting one renderer between
 * panes each frame.
 *
 * The counters are installed on `WebGL2RenderingContext.prototype` before any
 * page script runs, so they see the warm-up uploads too — hooking a live
 * context after load reports zero and cannot tell "everything is cached" from
 * "nothing painted". Draw calls are counted for exactly that reason: they are
 * the proof the frames being timed are real.
 *
 * Reports; does not gate. See tests/bench/README.md.
 */
import { test } from '@playwright/test';

const FRAMES = 120;

test('tiled-surface — uploads and frame time, two renderers on one context', async ({ page }) => {
  await page.addInitScript(() => {
    const w = window as unknown as { __glStats: Record<string, number> };
    w.__glStats = { buffers: 0, uploads: 0, uploadedBytes: 0, textures: 0, texBytes: 0, draws: 0 };
    const proto = WebGL2RenderingContext.prototype;

    const realCreateBuffer = proto.createBuffer;
    proto.createBuffer = function (...a: []) { w.__glStats.buffers++; return realCreateBuffer.apply(this, a); };

    const realBufferData = proto.bufferData;
    proto.bufferData = function (this: WebGL2RenderingContext, ...a: unknown[]) {
      w.__glStats.uploads++;
      const src = a[1];
      if (ArrayBuffer.isView(src)) w.__glStats.uploadedBytes += (src as ArrayBufferView).byteLength;
      else if (typeof src === 'number') w.__glStats.uploadedBytes += src;
      return (realBufferData as (...x: unknown[]) => unknown).apply(this, a);
    } as typeof proto.bufferData;

    const realCreateTexture = proto.createTexture;
    proto.createTexture = function (...a: []) { w.__glStats.textures++; return realCreateTexture.apply(this, a); };

    const realDrawElements = proto.drawElements;
    proto.drawElements = function (this: WebGL2RenderingContext, ...a: unknown[]) {
      w.__glStats.draws++;
      return (realDrawElements as (...x: unknown[]) => unknown).apply(this, a);
    } as typeof proto.drawElements;
  });

  await page.goto('/#tiled-surface');
  await page.waitForSelector('[data-testid="tiled-surface"]');
  await page.waitForTimeout(800);

  const warmup = await page.evaluate(() =>
    ({ ...(window as unknown as { __glStats: Record<string, number> }).__glStats }));

  // A drag, not a hover: a hover that changes nothing does not dirty the
  // surface, and the first version of this measured 120 frames of vsync with
  // zero draw calls behind them. The `draws` figure below is what caught it.
  const paneB = await page.evaluate(() => {
    const r = (document.querySelector('[data-pane="B"]') as HTMLElement).getBoundingClientRect();
    return { left: r.left, top: r.top };
  });
  const before = await page.evaluate(() =>
    ({ ...(window as unknown as { __glStats: Record<string, number> }).__glStats }));

  const t0 = Date.now();
  await page.mouse.move(paneB.left + 200, paneB.top + 180);
  await page.mouse.down();
  for (let i = 1; i <= FRAMES; i++) {
    await page.mouse.move(paneB.left + 200 + (i % 40), paneB.top + 180 + (i % 30));
  }
  await page.mouse.up();
  const elapsed = Date.now() - t0;

  const after = await page.evaluate(() =>
    ({ ...(window as unknown as { __glStats: Record<string, number> }).__glStats }));
  const steady = {
    elapsed,
    frames: FRAMES,
    draws: after.draws - before.draws,
    uploads: after.uploads - before.uploads,
    uploadedBytes: after.uploadedBytes - before.uploadedBytes,
    buffers: after.buffers - before.buffers,
  };

  console.log('  — warm-up, both renderers built ————————————');
  console.log(`  GL buffers created     ${warmup.buffers}`);
  console.log(`  bufferData calls       ${warmup.uploads}`);
  console.log(`  bytes uploaded         ${warmup.uploadedBytes}`);
  console.log(`  GL textures created    ${warmup.textures}`);
  console.log(`  draw calls             ${warmup.draws}`);
  console.log(`  — dragging in one pane, ${steady.frames} pointer moves ————`);
  console.log(`  wall clock             ${steady.elapsed} ms`);
  console.log(`  draw calls             ${steady.draws}   (0 would mean nothing repainted)`);
  console.log(`  per draw               ${(steady.elapsed / Math.max(steady.draws, 1)).toFixed(3)} ms`);
  console.log(`  GL buffers created     ${steady.buffers}`);
  console.log(`  bufferData calls       ${steady.uploads}`);
  console.log(`  bytes uploaded         ${steady.uploadedBytes}`);
});
