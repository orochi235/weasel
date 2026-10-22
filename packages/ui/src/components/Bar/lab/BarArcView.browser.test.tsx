import '@weasel-js/theme/tokens.css';
import '@weasel-js/theme/fonts.css';
import { cleanup, screen, within } from '@testing-library/react';
import { afterEach, expect, test } from 'vitest';
import { page } from 'vitest/browser';
import { arcShape, trackRun, type Point } from '@weasel-js/geom';
import { arcInBox } from '../../Along/arcInBox';
import { renderWithIcons } from '../../../testing/withIcons';
import { runPlaces } from '../runPlaces';
import { arcOf, BAR_ARC_DEFAULTS, BAR_ARC_PRESETS, type BarArcConfig } from './barArcConfig';
import { BarArcView } from './BarArcView';

afterEach(cleanup);

const frame = () => new Promise((r) => requestAnimationFrame(r));

/** A preset's knobs as the story's config, the way `setConfig` writes them. */
function presetConfig(name: string): BarArcConfig {
  const config = structuredClone(BAR_ARC_DEFAULTS) as unknown as Record<string, Record<string, unknown>>;
  for (const [path, value] of Object.entries(BAR_ARC_PRESETS.find((p) => p.name === name)!.config)) {
    const [group, key] = path.split('.') as [string, string];
    config[group]![key] = value;
  }
  return config as unknown as BarArcConfig;
}

const bar = () => screen.getByRole('toolbar', { name: 'Lens' });
const placed = () => [...bar().querySelectorAll<HTMLElement>(':scope > [data-bar-item], :scope > [data-bar-more]')];
const cell = (id: string) => document.querySelector(`[data-readout="${id}"] td`)!.textContent!.trim();

/** Frames until the bar's items stop moving: their lengths are measured after the first paint. */
async function settle() {
  let last = '';
  for (let i = 0; i < 30; i++) {
    await frame();
    const now = [...document.querySelectorAll('[style], [data-readout]')].map((el) => el.getAttribute('style') ?? el.textContent).join('|');
    if (now === last) return;
    last = now;
  }
}

/** The lab with `room` px above it, so a popover asked to open upward has the room to. */
async function mount(name: string, room = 0) {
  await page.viewport(1200, 1000);
  const config = presetConfig(name);
  renderWithIcons(
    <div style={{ paddingTop: room }}>
      <BarArcView config={config} onPreset={() => {}} />
    </div>,
  );
  await document.fonts.ready;
  await settle();
  const box = document.querySelector<HTMLElement>('[data-lab-box]')!;
  const { center, sweep, direction, inset, size } = config.arc;
  const run = trackRun(arcShape(arcInBox(arcOf({ center, sweep, direction, inset }), { width: size, height: size })));
  /** Px along the run to the element's center. */
  const along = (el: Element) => {
    const b = box.getBoundingClientRect();
    const r = el.getBoundingClientRect();
    const p: Point = { x: r.left + r.width / 2 - b.left, y: r.top + r.height / 2 - b.top };
    return run.nearest(p, { open: true }).f * run.length;
  };
  return { run, along };
}

test('a scrolled run: the wheel lays it back by its delta, and every item sits and clips where runPlaces puts it', async () => {
  const { run, along } = await mount('Too many, scroll');
  expect(cell('scrolls')).toBe('yes');
  expect(Number.parseFloat(cell('offset'))).toBe(0);
  const first = placed()[0]!;
  first.dispatchEvent(new WheelEvent('wheel', { bubbles: true, cancelable: true, deltaY: 40, deltaMode: 0 }));
  await settle();
  expect(Number.parseFloat(cell('offset'))).toBeCloseTo(40, 0);
  const lengths = placed().map((el) => el.offsetWidth);
  const gap = Number.parseFloat(getComputedStyle(bar()).columnGap);
  const spots = runPlaces(lengths, gap, run.length, 'center', 40);
  placed().forEach((el, i) => {
    const spot = spots[i]!;
    expect(el.getAttribute('data-clipped') ?? 'none', `item ${i}`).toBe(spot.clipped);
    // An item wholly past an end is drawn at that end; one partly past slides on along it, which an open nearest
    // reads back by angle, to within a pixel.
    if (spot.clipped === 'none') expect(along(el), `item ${i}`).toBeCloseTo(spot.center, 0);
    if (spot.clipped === 'part') expect(Math.abs(along(el) - spot.center), `item ${i}`).toBeLessThan(1);
  });
});

test("menu mode: More is the run's last item, holds the rest, and its popover opens outward, up off the top rim", async () => {
  const { along } = await mount('Too many, menu', 360);
  const items = placed();
  const more = items.at(-1)!;
  expect(more).toHaveAttribute('data-bar-more');
  for (const el of items.slice(0, -1)) expect(along(el)).toBeLessThan(along(more));
  expect(cell('more')).toMatch(/opens top$/);
  within(more).getByRole('button', { name: 'More' }).click();
  const dialog = await screen.findByRole('dialog', { name: 'More' });
  expect(within(dialog).getAllByRole('button')).toHaveLength(10 - (items.length - 1));
  await settle();
  expect(cell('popover')).toBe('More: top');
  expect(cell('popover-side')).toBe('top');
  expect(dialog.getBoundingClientRect().bottom).toBeLessThanOrEqual(more.getBoundingClientRect().top + 0.5);
});

test("a field's popover on the bottom rim opens downward, and one on the right side opens rightward", async () => {
  await mount('Fields on the bottom');
  bar().querySelector<HTMLElement>('[data-bar-item] button[aria-haspopup], [data-bar-item] button[aria-expanded]')!.click();
  await screen.findByRole('dialog');
  await settle();
  expect(cell('popover')).toMatch(/: bottom$/);
  expect(cell('popover-side')).toBe('bottom');
  cleanup();

  await mount('Right side, start');
  screen.getByRole('button', { name: /Gain/ }).click();
  await screen.findByRole('dialog');
  await settle();
  expect(cell('popover')).toBe('Gain: right');
});

test('align start sets the run against its reading start, align end against its end', async () => {
  const start = await mount('Right side, start');
  const first = placed()[0]!;
  expect(start.along(first) - first.offsetWidth / 2).toBeCloseTo(0, 0);
  cleanup();

  const end = await mount('Short, align end');
  const last = placed().at(-1)!;
  expect(end.along(last) + last.offsetWidth / 2).toBeCloseTo(end.run.length, 0);
});

test('a press on an action fires it', async () => {
  await mount('Six on the top rim');
  screen.getByRole('button', { name: 'Redo' }).click();
  await settle();
  expect(cell('pressed')).toBe('redo');
});
