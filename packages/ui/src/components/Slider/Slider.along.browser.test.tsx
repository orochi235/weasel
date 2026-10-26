import '@weasel-js/theme/tokens.css';
import '@weasel-js/theme/fonts.css';
import { useState } from 'react';
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, expect, test } from 'vitest';
import { lineShape } from '@weasel-js/geom';
import { Along } from '../Along';
import { Slider, type SliderProps, type Thumb } from './index';

afterEach(cleanup);

const STOPS = [2, 4, 8, 16].map((v) => ({ value: v, label: `${v}×` }));
const RADIUS = 104;

function Lens({ size = 240, underlay = false, transform, ...props }: { size?: number; underlay?: boolean; transform?: string } & Partial<SliderProps>) {
  const [thumbs, setThumbs] = useState<Thumb[]>([{ value: 4 }]);
  return (
    <div data-box style={{ position: 'relative', width: size, height: size, margin: 40, transform }}>
      {underlay && <button type="button" style={{ position: 'absolute', inset: 0 }}>under</button>}
      <Along arc={{ start: 240, end: 120, direction: 'ccw', inset: 16 }}>
        <Slider min={2} max={16} stops={STOPS} spacing="even" snap="strict" thumbs={thumbs} onInput={setThumbs} {...props} />
      </Along>
    </div>
  );
}

const frame = () => new Promise((r) => requestAnimationFrame(r));

async function mount(props: Parameters<typeof Lens>[0] = {}) {
  const view = render(<Lens {...props} />);
  await document.fonts.ready;
  await frame();
  await frame();
  const box = view.container.querySelector<HTMLElement>('[data-box]')!;
  const all = (sel: string) => [...view.container.querySelectorAll<HTMLElement>(sel)];
  return { view, box, all, thumb: screen.getByRole('slider') };
}

const mid = (el: Element) => {
  const r = el.getBoundingClientRect();
  return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
};
const circleCenter = (box: HTMLElement) => {
  const r = box.getBoundingClientRect();
  return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
};
const dist = (a: { x: number; y: number }, b: { x: number; y: number }) => Math.hypot(a.x - b.x, a.y - b.y);
/** The element's rotation, in degrees, read from its computed transform. */
const angleOf = (el: Element) => {
  const m = new DOMMatrix(getComputedStyle(el).transform);
  return (Math.atan2(m.b, m.a) * 180) / Math.PI;
};
const hit = (x: number, y: number) => document.elementFromPoint(x, y);
const lands = (el: Element, x: number, y: number) => {
  const h = hit(x, y);
  return h === el || el.contains(h);
};
const opts = (x: number, y: number) => ({ bubbles: true, pointerId: 1, button: 0, buttons: 1, clientX: x, clientY: y, isPrimary: true });

test('every tick and the thumb sit on the arc', async () => {
  const { box, all, thumb } = await mount();
  const c = circleCenter(box);
  const ticks = all('[data-slider-tick]');
  expect(ticks).toHaveLength(4);
  for (const el of [...ticks, thumb]) expect(Math.abs(dist(mid(el), c) - RADIUS)).toBeLessThanOrEqual(1);
});

/** A tick's length across the run: its untransformed height. */
const tickLength = (el: HTMLElement) => el.offsetHeight;
const strokeOf = (el: Element) => parseFloat(getComputedStyle(el).strokeWidth);
const band = (all: (sel: string) => HTMLElement[]) => all('[data-slider-band]')[0]!.parentElement!;
const face = (all: (sel: string) => HTMLElement[]) => band(all).lastElementChild!;

test('by default the band is half as thick as the ticks across it', async () => {
  const { all } = await mount();
  const tick = tickLength(all('[data-slider-tick]')[0]!);
  expect(tick).toBeGreaterThan(0);
  expect(strokeOf(face(all))).toBeCloseTo(tick / 2, 1);
});

test('an explicit track height wins over the default, and the ticks keep their length', async () => {
  const before = tickLength((await mount()).all('[data-slider-tick]')[0]!);
  cleanup();
  const { all } = await mount({ trackHeight: 20 });
  expect(strokeOf(face(all))).toBe(20);
  expect(tickLength(all('[data-slider-tick]')[0]!)).toBe(before);
});

test('the hit band and the thumb reach past the ticks, not just the thinner band', async () => {
  const { all, thumb } = await mount();
  const tick = tickLength(all('[data-slider-tick]')[0]!);
  const slop = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--wzl-slider-track-slop'));
  expect(strokeOf(all('[data-slider-band]')[0]!)).toBeCloseTo(tick + 2 * slop, 1);
  expect(thumb.offsetHeight).toBeGreaterThan(tick);
});

test('the minimum is on the left: values read left to right along the bottom rim', async () => {
  const { box, all } = await mount();
  const c = circleCenter(box);
  const xs = all('[data-slider-tick]').map((el) => mid(el).x);
  for (let i = 1; i < xs.length; i++) expect(xs[i]!).toBeGreaterThan(xs[i - 1]!);
  for (const el of all('[data-slider-tick]')) expect(mid(el).y).toBeGreaterThan(c.y);
});

test('stop labels are upright enough to read and hang below the track', async () => {
  const { box, all } = await mount();
  const c = circleCenter(box);
  const labels = all('[data-slider-stop-label]');
  expect(labels).toHaveLength(4);
  for (const el of labels) {
    const a = angleOf(el);
    expect(a).toBeGreaterThan(-90);
    expect(a).toBeLessThan(90);
    expect(dist(mid(el), c)).toBeGreaterThan(RADIUS);
  }
});

test('a press in the empty middle of the circle reaches what is beneath, not the track', async () => {
  const { box } = await mount({ underlay: true });
  const c = circleCenter(box);
  expect(hit(c.x, c.y)).toBe(screen.getByRole('button', { name: 'under' }));
});

test('a press on the band moves the thumb there, and a drag along the rim lands on a stop', async () => {
  const { all, thumb } = await mount();
  const [, , eight, sixteen] = all('[data-slider-tick]').map(mid);
  const target = hit(eight!.x, eight!.y)!;
  expect(target.hasAttribute('data-slider-band')).toBe(true);
  target.dispatchEvent(new PointerEvent('pointerdown', opts(eight!.x, eight!.y)));
  await frame();
  expect(thumb.getAttribute('aria-valuenow')).toBe('8');
  for (let i = 1; i <= 8; i++) {
    const x = eight!.x + ((sixteen!.x - eight!.x) * i) / 8;
    const y = eight!.y + ((sixteen!.y - eight!.y) * i) / 8;
    document.dispatchEvent(new PointerEvent('pointermove', opts(x, y)));
    await frame();
  }
  document.dispatchEvent(new PointerEvent('pointerup', opts(sixteen!.x, sixteen!.y)));
  await frame();
  expect(thumb.getAttribute('aria-valuenow')).toBe('16');
});

test('a press on the band focuses the thumb it moves there', async () => {
  const { all, thumb } = await mount();
  const eight = mid(all('[data-slider-tick]')[2]!);
  const target = hit(eight.x, eight.y)!;
  expect(target.hasAttribute('data-slider-band')).toBe(true);
  target.dispatchEvent(new PointerEvent('pointerdown', opts(eight.x, eight.y)));
  document.dispatchEvent(new PointerEvent('pointerup', opts(eight.x, eight.y)));
  await frame();
  expect(thumb.getAttribute('aria-valuenow')).toBe('8');
  expect(document.activeElement).toBe(thumb);
});

test('a press on a straight track focuses its thumb too', async () => {
  function Straight() {
    const [thumbs, setThumbs] = useState<Thumb[]>([{ value: 10 }]);
    return <div style={{ width: 300, margin: 40 }}><Slider min={0} max={100} step={1} thumbs={thumbs} onInput={setThumbs} /></div>;
  }
  const view = render(<Straight />);
  await frame();
  const rail = view.container.querySelector('[data-slider-rail]')!.getBoundingClientRect();
  const p = { x: rail.left + rail.width / 2, y: rail.top + rail.height / 2 };
  hit(p.x, p.y)!.dispatchEvent(new PointerEvent('pointerdown', opts(p.x, p.y)));
  document.dispatchEvent(new PointerEvent('pointerup', opts(p.x, p.y)));
  await frame();
  const thumb = screen.getByRole('slider');
  expect(thumb.getAttribute('aria-valuenow')).toBe('50');
  expect(document.activeElement).toBe(thumb);
});

test("the thumb's slop takes a press just off its edge", async () => {
  const { thumb } = await mount();
  const slop = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--wzl-slider-thumb-slop'));
  const c = mid(thumb);
  const rad = (angleOf(thumb) * Math.PI) / 180;
  // The thumb's own axes: along the run, and across it.
  const along = { x: Math.cos(rad), y: Math.sin(rad) };
  const across = { x: -Math.sin(rad), y: Math.cos(rad) };
  const at = (u: { x: number; y: number }, d: number) => [c.x + u.x * d, c.y + u.y * d] as const;
  const halfW = thumb.offsetWidth / 2;
  const halfH = thumb.offsetHeight / 2;
  expect(lands(thumb, ...at(along, halfW + slop - 1))).toBe(true);
  expect(lands(thumb, ...at(along, -(halfW + slop - 1)))).toBe(true);
  expect(lands(thumb, ...at(across, -(halfH + slop - 1)))).toBe(true);
  expect(lands(thumb, ...at(along, halfW + slop + 1))).toBe(false);
});

test('resizing the box moves the thumb onto the new rim', async () => {
  const { box, thumb } = await mount();
  box.style.width = '320px';
  box.style.height = '320px';
  await expect.poll(() => Math.abs(dist(mid(thumb), circleCenter(box)) - 144)).toBeLessThanOrEqual(1);
});

test("a readout below the thumb clears the stop label beside it", async () => {
  const { box, all, view } = await mount({ readoutPlacement: 'below-thumb', renderReadout: (t) => `${t.value}×` });
  const c = circleCenter(box);
  const readout = view.container.querySelector<HTMLElement>('[data-readout="below"]')!;
  const r = mid(readout);
  const label = all('[data-slider-stop-label]').reduce((a, b) => (dist(mid(a), r) <= dist(mid(b), r) ? a : b));
  expect(label.textContent).toBe('4×');
  // Both are tipped to the same normal, so each spans its own height along it.
  const labelOuter = dist(mid(label), c) + label.offsetHeight / 2;
  const readoutInner = dist(r, c) - readout.offsetHeight / 2;
  expect(readoutInner).toBeGreaterThanOrEqual(labelOuter - 0.5);
});

for (const [name, transform, scale] of [
  ['scaled down', 'scale(0.5)', 0.5],
  ['scaled up', 'scale(1.5)', 1.5],
  ['rotated', 'rotate(90deg)', 1],
  ['rotated and scaled', 'rotate(-35deg) scale(0.75)', 0.75],
] as const) {
  test(`under a ${name} ancestor the ticks sit on the rim and a press on one moves the thumb to it`, async () => {
    const { box, all, thumb } = await mount({ transform });
    const c = circleCenter(box);
    const ticks = all('[data-slider-tick]');
    for (const el of ticks) expect(Math.abs(dist(mid(el), c) - RADIUS * scale)).toBeLessThanOrEqual(1);
    const eight = mid(ticks[2]!);
    hit(eight.x, eight.y)!.dispatchEvent(new PointerEvent('pointerdown', opts(eight.x, eight.y)));
    document.dispatchEvent(new PointerEvent('pointerup', opts(eight.x, eight.y)));
    await frame();
    expect(thumb.getAttribute('aria-valuenow')).toBe('8');
  });
}

test('a line shape is laid where its coordinates say, and a press on it lands on the stop there', async () => {
  // A diagonal, so neither the straight layout nor a level line could pass by accident.
  const from = { x: 30, y: 200 };
  const to = { x: 210, y: 80 };
  const { box, all, thumb } = await mount({ shape: lineShape(from, to) });
  const r = box.getBoundingClientRect();
  const a = { x: r.left + from.x, y: r.top + from.y };
  const b = { x: r.left + to.x, y: r.top + to.y };
  const len = dist(a, b);
  /** How far `p` lies off the line through a and b, and how far along it, 0..1. */
  const off = (p: { x: number; y: number }) => Math.abs((b.x - a.x) * (a.y - p.y) - (a.x - p.x) * (b.y - a.y)) / len;
  const along = (p: { x: number; y: number }) => ((p.x - a.x) * (b.x - a.x) + (p.y - a.y) * (b.y - a.y)) / len ** 2;
  const ticks = all('[data-slider-tick]');
  expect(ticks).toHaveLength(4);
  for (const el of [...ticks, thumb]) expect(off(mid(el))).toBeLessThanOrEqual(1);
  const gs = ticks.map((el) => along(mid(el)));
  for (let i = 1; i < gs.length; i++) expect(gs[i]!).toBeGreaterThan(gs[i - 1]!);
  expect(gs[0]!).toBeGreaterThanOrEqual(0);
  expect(gs.at(-1)!).toBeLessThanOrEqual(1);
  const sixteen = mid(ticks[3]!);
  hit(sixteen.x, sixteen.y)!.dispatchEvent(new PointerEvent('pointerdown', opts(sixteen.x, sixteen.y)));
  document.dispatchEvent(new PointerEvent('pointerup', opts(sixteen.x, sixteen.y)));
  await frame();
  expect(thumb.getAttribute('aria-valuenow')).toBe('16');
});
