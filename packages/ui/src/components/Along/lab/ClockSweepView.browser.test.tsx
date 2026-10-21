import '@weasel-js/theme/tokens.css';
import '@weasel-js/theme/fonts.css';
import { cleanup } from '@testing-library/react';
import { afterEach, expect, test } from 'vitest';
import { page } from 'vitest/browser';
import { arcShape, trackRun, type Point, type TrackRun } from '@weasel-js/geom';
import { arcInBox } from '../arcInBox';
import { renderWithIcons } from '../../../testing/withIcons';
import { ClockSweepView, sweepArc, type ClockSweepConfig } from './ClockSweepView';

afterEach(cleanup);

const CONFIG: ClockSweepConfig = { span: 90, size: 220, fineRange: 4, fineStep: 2, show: 'both' };

const frame = () => new Promise((r) => requestAnimationFrame(r));

/** Frames until nothing in the lab moves: bars measure their items after the first paint. */
async function settle(root: HTMLElement) {
  let last = '';
  for (let i = 0; i < 40; i++) {
    await frame();
    const now = [...root.querySelectorAll('[style]')].map((el) => el.getAttribute('style')).join('|');
    if (now === last) return;
    last = now;
  }
}

async function mount() {
  await page.viewport(1400, 900);
  const view = renderWithIcons(<ClockSweepView config={CONFIG} />);
  await document.fonts.ready;
  await settle(view.container);
  return [...view.container.querySelectorAll<HTMLElement>('[data-sweep-at]')];
}

const mid = (el: Element): Point => {
  const r = el.getBoundingClientRect();
  return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
};
/** The element's rotation in degrees, read from its computed transform. */
const angleOf = (el: Element) => {
  const m = new DOMMatrix(getComputedStyle(el).transform);
  return (Math.atan2(m.b, m.a) * 180) / Math.PI;
};
const wrap = (deg: number) => ((((deg + 180) % 360) + 360) % 360) - 180;

/** Where `el`'s center falls along `run`, `box` being the element the run's coordinates are measured in. */
function gOn(run: TrackRun, box: Element, el: Element): number {
  const b = box.getBoundingClientRect();
  const p = mid(el);
  return run.nearest({ x: p.x - b.left, y: p.y - b.top }).f;
}

/** `trackRun` over the arc an Along of `inset` lays in `box`, as the lab builds it. */
function runIn(box: Element, at: number, inset: number): TrackRun {
  const { width, height } = box.getBoundingClientRect();
  return trackRun(arcShape(arcInBox(sweepArc(at, CONFIG.span, inset), { width, height })));
}

/** Parts in DOM order: each tipped as `run` says at its own spot, and laid in reading order along it. A run is
 *  turned over by its middle alone, so a part near the end of a run across 3 or 9 o'clock may tip past 90°. */
function expectReadAlong(run: TrackRun, box: Element, parts: Element[], what: string) {
  expect(parts.length, what).toBeGreaterThan(1);
  const gs = parts.map((el) => gOn(run, box, el));
  parts.forEach((el, i) => {
    const want = run.at(gs[i]!).angle;
    expect(Math.abs(wrap(angleOf(el) - want)), `${what} part ${i} tipped ${angleOf(el).toFixed(1)}°, run says ${want.toFixed(1)}°`).toBeLessThanOrEqual(1);
  });
  for (let i = 1; i < gs.length; i++) expect(gs[i]!, `${what} parts read in order`).toBeGreaterThan(gs[i - 1]!);
}

test('every dial: its caption is trackRun’s verdict, and each bar item is tipped and ordered as the run says', async () => {
  const dials = await mount();
  // 12 hours, and 5 bearings either side of 3 and of 9 o'clock.
  expect(dials).toHaveLength(22);
  for (const dial of dials) {
    const at = Number(dial.dataset.sweepAt);
    const bar = dial.querySelector<HTMLElement>('[role="toolbar"]')!;
    const run = runIn(bar, at, 16);
    expect(dial.dataset.flipped, `${at}° flipped`).toBe(String(run.flipped));
    expect(dial.dataset.reversed, `${at}° reversed`).toBe(String(run.reversed));
    expectReadAlong(run, bar, [...bar.querySelectorAll(':scope > [data-bar-item]')], `bar at ${at}°`);
  }
});

test('every dial: the slider’s stops run min to max in the run’s reading order, each tipped as the run says', async () => {
  const dials = await mount();
  for (const dial of dials) {
    const at = Number(dial.dataset.sweepAt);
    const thumb = dial.querySelector<HTMLElement>('[role="slider"]')!;
    const along = dial.querySelector<HTMLElement>('[role="toolbar"]')!.parentElement!.nextElementSibling!;
    const run = runIn(along, at, 64);
    const ticks = [...dial.querySelectorAll('[data-slider-tick]')];
    expect(ticks, `${at}° ticks`).toHaveLength(3);
    expectReadAlong(run, along, ticks, `slider at ${at}°`);
    expect(Math.abs(wrap(angleOf(thumb) - run.at(gOn(run, along, thumb)).angle)), `thumb at ${at}°`).toBeLessThanOrEqual(1);
  }
});

test('the flip changes sides exactly at 3 and 9 o’clock', async () => {
  const dials = await mount();
  const flipped = (at: number) => dials.find((d) => Number(d.dataset.sweepAt) === at)!.dataset.flipped;
  expect([86, 88, 90, 92, 94].map(flipped)).toEqual(['false', 'false', 'false', 'true', 'true']);
  expect([266, 268, 270, 272, 274].map(flipped)).toEqual(['true', 'true', 'false', 'false', 'false']);
});
