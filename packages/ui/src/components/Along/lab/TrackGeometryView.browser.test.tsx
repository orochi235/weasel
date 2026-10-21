import '@weasel-js/theme/tokens.css';
import '@weasel-js/theme/fonts.css';
import { useState } from 'react';
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, expect, test } from 'vitest';
import { page } from 'vitest/browser';
import { arcShape, trackRun, type ArcTrackSpec, type Point } from '@weasel-js/geom';
import { STAGE, TrackGeometryView, type TrackGeometryConfig } from './TrackGeometryView';

beforeEach(() => localStorage.clear());
afterEach(() => {
  cleanup();
  localStorage.clear();
});

function Lab() {
  const [config, setConfig] = useState<TrackGeometryConfig>({ direction: 'cw', stations: 7 });
  return <TrackGeometryView config={config} onConfig={(patch) => setConfig((c) => ({ ...c, ...patch }))} />;
}

const frame = () => new Promise((r) => requestAnimationFrame(r));
const readout = (id: string) => document.querySelector(`[data-readout="${id}"] td`)!.textContent!.trim();
const number = (id: string) => Number.parseFloat(readout(id).replace(/[^\d.-]/g, ''));

async function mount() {
  await page.viewport(1200, 900);
  render(<Lab />);
  await document.fonts.ready;
  for (let i = 0; i < 5; i++) await frame();
  const canvas = document.querySelector('canvas')!;
  return { canvas };
}

/** A press on the canvas at stage point `from`, dragged in steps to `to`, as the kit's move tool takes it. */
async function drag(canvas: HTMLCanvasElement, from: Point, to: Point) {
  const r = canvas.getBoundingClientRect();
  const at = (p: Point, buttons = 1) => ({ bubbles: true, pointerId: 1, pointerType: 'mouse', isPrimary: true, button: 0, buttons, clientX: r.left + p.x, clientY: r.top + p.y });
  canvas.dispatchEvent(new PointerEvent('pointerdown', at(from)));
  for (let i = 1; i <= 12; i++) {
    canvas.dispatchEvent(new PointerEvent('pointermove', at({ x: from.x + ((to.x - from.x) * i) / 12, y: from.y + ((to.y - from.y) * i) / 12 })));
    await frame();
  }
  canvas.dispatchEvent(new PointerEvent('pointerup', at(to, 0)));
  for (let i = 0; i < 3; i++) await frame();
}

const CENTER = { x: 280, y: 236 };
const spec = (start: number, end: number, direction: 'cw' | 'ccw'): ArcTrackSpec => ({ center: CENTER, radius: 150, start, end, direction });

test('opens on the top half: 270° to 90°, upright, reading left to right', async () => {
  await mount();
  expect(readout('start')).toBe('270°');
  expect(readout('end')).toBe('90°');
  expect(readout('sweep')).toBe('180°');
  expect(readout('flipped')).toBe('false');
  expect(readout('reading')).toBe('left to right');
});

test("a probe dragged on the canvas reads trackRun's nearest, closed and open", async () => {
  const { canvas } = await mount();
  const to = { x: 120, y: 360 };
  await drag(canvas, { x: 470, y: 90 }, to);
  const run = trackRun(arcShape(spec(270, 90, 'cw')));
  expect(number('run-g')).toBeCloseTo(run.nearest(to).f, 3);
  expect(number('run-g-open')).toBeCloseTo(run.nearest(to, { open: true }).f, 3);
  // Below the arc's left end, so an open projection runs on past its start.
  expect(number('run-g-open')).toBeLessThan(0);
  expect(number('dist')).toBeCloseTo(run.nearest(to).dist, 1);
});

test("loading the bottom rim counterclockwise shows trackRun's flip and every tip angle it gives", async () => {
  await mount();
  screen.getByRole('button', { name: 'Bottom, ccw' }).click();
  for (let i = 0; i < 3; i++) await frame();
  const run = trackRun(arcShape(spec(240, 120, 'ccw')));
  expect(readout('start')).toBe('240°');
  expect(readout('end')).toBe('120°');
  expect(readout('flipped')).toBe(String(run.flipped));
  expect(readout('reversed')).toBe(String(run.reversed));
  expect(readout('reading')).toBe('left to right');
  for (let i = 0; i < 7; i++) expect(number(`tip-${i}`)).toBeCloseTo(run.at(i / 6).angle, 1);
});

test('dragging the start handle sets the start to its bearing, and the handles are kept for the next visit', async () => {
  const { canvas } = await mount();
  // The start handle sits at 270°, on the circle's left; dragged down-left to 225°.
  await drag(canvas, { x: 130, y: 236 }, { x: 280 - 120, y: 236 + 120 });
  expect(readout('start')).toBe('225°');
  expect(readout('sweep')).toBe('225°');
  const saved = JSON.parse(localStorage.getItem('weasel-track-geometry-lab-v1')!);
  expect(saved.start.x).toBeCloseTo(160, 0);
  expect(saved.start.y).toBeCloseTo(356, 0);
});

test('the canvas paints the arc where geom puts it and not where it is not', async () => {
  const { canvas } = await mount();
  screen.getByRole('button', { name: 'Bottom, cw' }).click();
  for (let i = 0; i < 5; i++) await frame();
  const base64 = await page.screenshot({ element: canvas, save: false });
  const img = new Image();
  img.src = `data:image/png;base64,${base64}`;
  await img.decode();
  const c = document.createElement('canvas');
  c.width = img.naturalWidth;
  c.height = img.naturalHeight;
  const ctx = c.getContext('2d')!;
  ctx.drawImage(img, 0, 0);
  const k = img.naturalWidth / STAGE.width;
  /** The darkest pixel within 2 px of stage point `p`, as the sum of its channels. */
  const darkest = (p: Point) => {
    let min = Infinity;
    const { data } = ctx.getImageData(Math.round((p.x - 2) * k), Math.round((p.y - 2) * k), Math.round(4 * k), Math.round(4 * k));
    for (let i = 0; i < data.length; i += 4) min = Math.min(min, data[i]! + data[i + 1]! + data[i + 2]!);
    return min;
  };
  const shape = arcShape(spec(120, 240, 'cw'));
  // A third of the way along is on the arc, drawn in ink, clear of the radius handle at its middle; the top of
  // the circle is not on it, and has at most the dashed circle.
  expect(darkest(shape.at(0.3).point)).toBeLessThan(250);
  expect(darkest({ x: 280, y: 86 })).toBeGreaterThan(400);
});
