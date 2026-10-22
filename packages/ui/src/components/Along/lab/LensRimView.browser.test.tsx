import '@weasel-js/theme/tokens.css';
import '@weasel-js/theme/fonts.css';
import { cleanup, screen } from '@testing-library/react';
import { afterEach, beforeEach, expect, test } from 'vitest';
import { page, userEvent } from 'vitest/browser';
import type { Point } from '@weasel-js/geom';
import { renderWithIcons } from '../../../testing/withIcons';
import { LensRimView, type LensRimConfig } from './LensRimView';

beforeEach(() => localStorage.clear());
afterEach(() => {
  cleanup();
  localStorage.clear();
});

const frame = () => new Promise((r) => requestAnimationFrame(r));
const settle = async () => {
  for (let i = 0; i < 8; i++) await frame();
};

async function mount(config: Partial<LensRimConfig> = {}) {
  await page.viewport(1200, 900);
  renderWithIcons(<LensRimView config={{ size: 260, turn: 0, actions: 4, overflow: 'scroll', boxes: false, ...config }} />);
  await document.fonts.ready;
  await settle();
  const lens = document.querySelector<HTMLElement>('[data-lens]')!;
  const r = lens.getBoundingClientRect();
  return { center: { x: r.left + r.width / 2, y: r.top + r.height / 2 } };
}

const cell = (id: string) => document.querySelector(`[data-readout="${id}"] td`)!.textContent!.trim();
/** The last mark's picture px, as the readout gives them. */
const lastMark = () => cell('last-mark').split(',').map((v) => Number.parseFloat(v.replace(/[^\d.-]/g, '')));
const marks = () => [...document.querySelectorAll<HTMLElement>('[data-mark]')];
const mid = (el: Element): Point => {
  const r = el.getBoundingClientRect();
  return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
};

/** A press at client point `p`, on whatever the page puts there. */
async function pressAt(p: Point) {
  const target = document.elementFromPoint(p.x, p.y)!;
  const init = { bubbles: true, pointerId: 1, pointerType: 'mouse', isPrimary: true, button: 0, buttons: 1, clientX: p.x, clientY: p.y };
  target.dispatchEvent(new PointerEvent('pointerdown', init));
  target.dispatchEvent(new PointerEvent('pointerup', { ...init, buttons: 0 }));
  await settle();
  return target;
}

test('a press in the middle of the lens goes past both controls to the picture, and is marked there', async () => {
  const { center } = await mount();
  const target = await pressAt(center);
  expect(target.closest('[data-lens-picture]')).not.toBeNull();
  expect(marks()).toHaveLength(1);
  expect(lastMark()).toEqual([130, 130]);
  expect(cell('pressed')).toBe('picture');
});

test('turned and zoomed, a press is marked in the picture’s own px, and the mark is drawn where it was pressed', async () => {
  const { center } = await mount({ turn: 90 });
  screen.getByRole('slider', { name: 'Zoom' }).focus();
  await userEvent.keyboard('{ArrowRight}');
  await settle();
  expect(cell('zoom')).toBe('2×');
  const p = { x: center.x + 40, y: center.y };
  await pressAt(p);
  // Turned a quarter clockwise, the picture's up points right: 40 px right of the middle is 20 picture px above it.
  expect(lastMark()).toEqual([130, 110]);
  const drawn = mid(marks()[0]!);
  expect(Math.hypot(drawn.x - p.x, drawn.y - p.y)).toBeLessThanOrEqual(1);
});

test('a press on a rim control is the control’s: an action fires and the zoom band moves the zoom, and neither marks the picture', async () => {
  await mount();
  const redo = screen.getByRole('button', { name: 'Redo' });
  const target = await pressAt(mid(redo));
  expect(redo.contains(target)).toBe(true);
  redo.click();
  await settle();
  expect(cell('pressed')).toBe('redo');

  const ticks = [...document.querySelectorAll('[data-lens] [data-slider-tick]')];
  const band = await pressAt(mid(ticks.at(-1)!));
  expect(band.closest('[data-lens-picture]')).toBeNull();
  expect(cell('zoom')).toBe('8×');
  expect(marks()).toHaveLength(0);
});

test('turned, the bar and the zoom go round with the lens', async () => {
  const { center } = await mount({ turn: 90 });
  const items = [...screen.getByRole('toolbar', { name: 'Lens' }).querySelectorAll(':scope > [data-bar-item]')];
  const xs = items.map((el) => mid(el).x);
  // The top rim turned a quarter is the right rim: every action right of the middle.
  for (const x of xs) expect(x).toBeGreaterThan(center.x + 60);
  for (const tick of document.querySelectorAll('[data-lens] [data-slider-tick]')) expect(mid(tick).x).toBeLessThan(center.x - 60);
});
