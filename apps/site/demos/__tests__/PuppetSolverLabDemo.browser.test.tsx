import '@weasel-js/theme/tokens.css';
import '../../canvas-kit-demo.css';
import { asNodeId, type EditableShape } from '@weasel-js/core';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, expect, test } from 'vitest';
import { page, userEvent } from 'vitest/browser';
import { createLabScene, PuppetSolverLabDemo, SHAPE_ID } from '../PuppetSolverLabDemo';
import { meshModelOf } from '../puppetSolverLab/meshModel';
import { withIcons } from '../../testIcons';
import { canvasGl } from '@weasel-js/core/testing/canvasPixels';

afterEach(cleanup);

/** Index 1 of the trace is the second linear step: what the two-step solve alone returns. */
const TWO_STEP = 1;

/** How many of the scene canvas's pixels are magenta inside a CSS-pixel rect, read back from its GL context. */
function magentaIn(canvas: HTMLCanvasElement, x0 = 0, y0 = 0, x1 = Infinity, y1 = Infinity): number {
  const gl = canvasGl(canvas);
  const rect = canvas.getBoundingClientRect();
  const dpr = canvas.width / rect.width;
  const px = new Uint8Array(canvas.width * canvas.height * 4);
  gl.readPixels(0, 0, canvas.width, canvas.height, gl.RGBA, gl.UNSIGNED_BYTE, px);
  let n = 0;
  for (let y = Math.max(0, Math.floor(y0)); y < Math.min(rect.height, y1); y++) {
    for (let x = Math.max(0, Math.floor(x0)); x < Math.min(rect.width, x1); x++) {
      const i = (Math.round(canvas.height - 1 - y * dpr) * canvas.width + Math.round(x * dpr)) * 4;
      if (px[i] > 200 && px[i + 1] < 110 && px[i + 2] > 160) n++;
    }
  }
  return n;
}

async function mount() {
  await page.viewport(1100, 800);
  const { container } = render(<PuppetSolverLabDemo />, { wrapper: withIcons });
  await expect.poll(() => container.querySelector('.lk-trial-scene canvas'), { timeout: 8000 }).toBeTruthy();
  await expect.poll(() => screen.queryByTestId('step')?.textContent, { timeout: 8000 }).toMatch(/^\d+\/\d+$/);
  return { container, canvas: () => container.querySelector<HTMLCanvasElement>('.lk-trial-scene canvas')! };
}

const scrubTo = (index: number) =>
  act(() => { fireEvent.change(screen.getByRole('slider', { name: 'Step of the solve' }), { target: { value: String(index) } }); });

test('the squashed disc paints its fold magenta at step 2, none once untangled, and the gentle bend none', async () => {
  const { canvas } = await mount();
  await expect.poll(() => screen.getByTestId('inverted').textContent, { timeout: 8000 }).toBe('0');
  expect(magentaIn(canvas())).toBe(0);

  await scrubTo(TWO_STEP);
  // Where step 2's turned-over triangle lies, in world space; the view opens unscrolled at 1:1.
  const model = meshModelOf(createLabScene('disc').get(asNodeId(SHAPE_ID)) as EditableShape, TWO_STEP)!;
  const t = model.ratio.findIndex((r) => r <= 0);
  const corner = (k: number, c: number) => model.world[2 * model.triangles[3 * t + k] + c];
  const cx = (corner(0, 0) + corner(1, 0) + corner(2, 0)) / 3, cy = (corner(0, 1) + corner(1, 1) + corner(2, 1)) / 3;
  await expect.poll(() => magentaIn(canvas(), cx - 14, cy - 14, cx + 14, cy + 14), { timeout: 8000 }).toBeGreaterThan(20);
  const away = magentaIn(canvas()) - magentaIn(canvas(), cx - 16, cy - 16, cx + 16, cy + 16);
  expect(away, 'step 2 of the disc has no other turned-over triangle').toBe(0);

  await userEvent.click(screen.getByRole('radio', { name: 'Bend' }));
  await expect.poll(() => screen.queryByTestId('step')?.textContent, { timeout: 8000 }).toMatch(/^\d+\/\d+$/);
  await scrubTo(TWO_STEP);
  await expect.poll(() => screen.getByTestId('step').textContent, { timeout: 8000 }).toMatch(/^2\//);
  expect(magentaIn(canvas())).toBe(0);
});

const fire = (el: Element, type: string, x: number, y: number) =>
  el.dispatchEvent(new PointerEvent(type, {
    bubbles: true, cancelable: true, pointerId: 1, pointerType: 'mouse', isPrimary: true,
    button: 0, buttons: type === 'pointerup' ? 0 : 1, clientX: x, clientY: y,
  }));

test('step 2’s mesh and count follow a pin dragged halfway back, where its fold grows', async () => {
  const { canvas } = await mount();
  await scrubTo(TWO_STEP);
  await expect.poll(() => screen.getByTestId('inverted').textContent, { timeout: 8000 }).toBe('1');
  const before = magentaIn(canvas());

  // The disc's top pin sits at (134, 108), and was placed at (160, 82).
  const { left, top } = canvas().getBoundingClientRect();
  await act(async () => {
    fire(canvas(), 'pointerdown', left + 134, top + 108);
    for (let i = 1; i <= 8; i++) fire(canvas(), 'pointermove', left + 134 + (13 * i) / 8, top + 108 - (13 * i) / 8);
    fire(canvas(), 'pointerup', left + 147, top + 95);
  });
  await expect.poll(() => Number(screen.getByTestId('inverted').textContent), { timeout: 8000 }).toBeGreaterThan(1);
  await expect.poll(() => magentaIn(canvas()), { timeout: 8000 }).toBeGreaterThan(before);
});

test('the canvas, its controls and the panel fit a window 800 px tall', async () => {
  const { container, canvas } = await mount();
  const frame = container.firstElementChild!.getBoundingClientRect();
  const box = canvas().getBoundingClientRect();
  expect(frame.height).toBeLessThanOrEqual(460);
  expect(box.height).toBeLessThanOrEqual(420);
  expect(box.height).toBeGreaterThan(300);
});
