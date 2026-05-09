/**
 * Stress harness: drag Card 'a' in AnimationDemo 100 times under backend=gl.
 *
 * Goal: prove the GL backend doesn't accumulate lag, leak GPU resources, or
 * crash across many drag-release cycles. Tweens run for ~250ms after each
 * release; the harness waits long enough for that to settle, then drives the
 * next drag.
 *
 * Failure modes this catches:
 *   - Console errors (GL errors, React errors, animator unmount tripwire)
 *   - Page errors / renderer-process crashes
 *   - Mean per-cycle wall time creeping above 600ms (rAF starvation, GC pauses,
 *     unbounded animation maps, etc.)
 *   - Canvas going entirely black (renderer broken / context lost).
 */
import { test, expect } from '@playwright/test';

// Each cycle waits 280ms for animation to settle, plus drag I/O, so 100 cycles
// take >= 30s. Give plenty of headroom so a slow run still produces signal.
test.setTimeout(120_000);

test('animation demo: 100 drag-release cycles without lag or crash', async ({ page }) => {
  const consoleErrors: string[] = [];
  page.on('console', (msg) => {
    if (msg.type() === 'error') consoleErrors.push(msg.text());
  });
  page.on('pageerror', (err) => {
    consoleErrors.push(`pageerror: ${err.message}`);
  });
  page.on('crash', () => consoleErrors.push('page crashed'));

  await page.goto('/weasel/?backend=gl#animation');
  await page.waitForSelector('canvas');
  // Wait for the initial enter animation (250ms) plus a margin.
  await page.waitForTimeout(500);

  const canvas = page.locator('canvas').first();
  const box = await canvas.boundingBox();
  if (!box) throw new Error('canvas has no bounding box');

  // AnimationDemo INITIAL has card 'a' at world (100,100) size 80x60. The
  // demo canvas is 600x400 with 1:1 mapping, so card 'a' center in canvas-
  // local coords ≈ (140, 130). Translate to viewport coords.
  const startCx = box.x + 140;
  const startCy = box.y + 130;
  let curX = startCx;
  let curY = startCy;

  const t0 = Date.now();
  const cycleTimes: number[] = [];

  for (let i = 0; i < 100; i++) {
    const tCycleStart = Date.now();
    // Bounce the target offset around so the card doesn't drift in one
    // direction. Bounds (-40..40, -45..45) keep card 'a' on-canvas.
    const dx = (i % 5) * 20 - 40;
    const dy = ((i % 7) * 15) - 45;
    const targetX = startCx + dx;
    const targetY = startCy + dy;

    await page.mouse.move(curX, curY);
    await page.mouse.down();
    for (let s = 1; s <= 4; s++) {
      const lx = curX + ((targetX - curX) * s) / 4;
      const ly = curY + ((targetY - curY) * s) / 4;
      await page.mouse.move(lx, ly, { steps: 2 });
    }
    await page.mouse.up();
    curX = targetX;
    curY = targetY;
    await page.waitForTimeout(280); // settle the tween before driving next drag
    cycleTimes.push(Date.now() - tCycleStart);
  }
  const totalMs = Date.now() - t0;

  // Confirm rendering still works by counting non-zero pixels across the
  // whole canvas. A single center sample is unreliable because momentum
  // drift may push cards away from the center over 100 cycles, but a fully
  // zero buffer is the symptom we actually care about (broken renderer /
  // lost context).
  const nonZeroCount = await page.evaluate(() => {
    const c = document.querySelector('canvas') as HTMLCanvasElement;
    const gl = c.getContext('webgl2') as WebGL2RenderingContext | null;
    if (!gl) return -1;
    const buf = new Uint8Array(c.width * c.height * 4);
    gl.readPixels(0, 0, c.width, c.height, gl.RGBA, gl.UNSIGNED_BYTE, buf);
    let n = 0;
    for (let i = 0; i < buf.length; i += 4) {
      if (buf[i] > 0 || buf[i + 1] > 0 || buf[i + 2] > 0 || buf[i + 3] > 0) n++;
    }
    return n;
  });

  const mean = totalMs / 100;
  const sorted = [...cycleTimes].sort((a, b) => a - b);
  const p95 = sorted[Math.floor(sorted.length * 0.95)];
  console.log(
    `Stress: 100 cycles in ${totalMs}ms; mean ${mean.toFixed(0)}ms/cycle; p95 ${p95}ms; non-zero pixels=${nonZeroCount}`,
  );
  if (consoleErrors.length > 0) {
    console.log(`Errors captured: ${consoleErrors.length}`);
    for (const e of consoleErrors.slice(0, 5)) console.log('  ', e);
  }

  expect(consoleErrors).toEqual([]);
  expect(nonZeroCount).toBeGreaterThan(0);
  // Mean cycle should stay close to the 280ms wait. Above 600ms means
  // significant lag accumulation or rAF starvation.
  expect(mean).toBeLessThan(600);
});
