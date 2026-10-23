import '@weasel-js/theme/tokens.css';
import '@weasel-js/theme/fonts.css';
import { cleanup, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, expect, test } from 'vitest';
import { page } from 'vitest/browser';
import { renderWithIcons } from '../../../testing/withIcons';
import { arcInBox } from '../../Along/arcInBox';
import { SWATCH_ARC_DEFAULTS, swatchArcOf, type SwatchArcConfig } from './swatchArcConfig';
import { readRings } from './useRingReading';
import { SwatchArcView } from './SwatchArcView';

afterEach(cleanup);

const frame = () => new Promise((r) => requestAnimationFrame(r));

/** Frames until nothing under the lab moves: items are measured after the first paint, rings after that. */
async function settle() {
  let last = '';
  for (let i = 0; i < 30; i++) {
    await frame();
    const now = [...document.querySelectorAll('[style]')].map((el) => el.getAttribute('style')).join('|');
    if (now === last) return;
    last = now;
  }
}

async function mount(arc: Partial<SwatchArcConfig['arc']> = {}, swatches: Partial<SwatchArcConfig['swatches']> = {}) {
  await page.viewport(1400, 1000);
  const config = { arc: { ...SWATCH_ARC_DEFAULTS.arc, ...arc }, swatches: { ...SWATCH_ARC_DEFAULTS.swatches, ...swatches } };
  renderWithIcons(<SwatchArcView config={config} />);
  await document.fonts.ready;
  await settle();
  const { size, ...rest } = config.arc;
  const spec = arcInBox(swatchArcOf(rest), { width: size, height: size });
  const box = document.querySelector<HTMLElement>('[data-lab-box]')!;
  return { spec, rings: () => readRings(box, spec.center) };
}

for (const [name, arc] of [
  ['top, clockwise', { center: 0, direction: 'cw' }],
  ['top, counterclockwise', { center: 0, direction: 'ccw' }],
  ['bottom, counterclockwise', { center: 180, direction: 'ccw' }],
  ['bottom, clockwise', { center: 180, direction: 'cw' }],
] as const) {
  test(`${name}: the rings are concentric, a pitch apart going in, each one's swatches evenly spaced`, async () => {
    const { spec, rings } = await mount(arc);
    const read = rings();
    // Six recents and the basic palette's twenty, ten to a ring.
    expect(read.map((r) => `${r.group} ${r.swatches}`)).toEqual(['Recent colors 6', 'Basic 10', 'Basic 10']);
    const pitch = 20 + 4;
    read.forEach((r, k) => {
      expect(r.radius, `ring ${k}`).toBeCloseTo(spec.radius - k * pitch, 0);
      expect(r.radiusSpread, `ring ${k}`).toBeLessThan(1);
      expect(r.spacing, `ring ${k}`).toBeCloseTo(pitch, 0);
      expect(r.spacingSpread, `ring ${k}`).toBeLessThan(1);
    });
    // Each section's heading leads its first ring, on it.
    expect(read[0]!.lead).toBeCloseTo(read[0]!.radius, 0);
    expect(read[1]!.lead).toBeCloseTo(read[1]!.radius, 0);
    expect(read[2]!.lead).toBeUndefined();
    // A swatch on the ring is the size the stylesheet gives it, not the grid's stretched square.
    expect(document.querySelector<HTMLElement>('[data-swatch]')!.offsetWidth).toBe(20);
  });
}

test('the headings read upright on a bottom arc, and come before the swatches in reading order', async () => {
  await mount({ center: 180, direction: 'ccw' });
  const heading = screen.getByText('Recent');
  const lead = heading.closest<HTMLElement>('[data-ring-item]')!;
  expect(lead.style.getPropertyValue('--at-upright')).toBe('0deg');
  const angle = Number.parseFloat(lead.style.getPropertyValue('--at-angle'));
  expect(Math.abs(angle)).toBeLessThan(90);
  const first = screen.getByRole('group', { name: 'Recent colors' }).querySelector('[data-swatch]')!;
  expect(lead.getBoundingClientRect().left).toBeLessThan(first.getBoundingClientRect().left);
});

test('the arrows rove along a ring and across to the next one in', async () => {
  const { rings } = await mount();
  const basic = screen.getByRole('group', { name: 'Basic' });
  const swatches = [...basic.querySelectorAll<HTMLElement>('[data-swatch]')];
  swatches[0]!.focus();
  await userEvent.keyboard('{ArrowRight}');
  expect(document.activeElement).toBe(swatches[1]);
  await userEvent.keyboard('{ArrowDown}');
  expect(document.activeElement).toBe(swatches[11]);
  expect(swatches[11]!.closest('[data-ring]')).not.toBe(swatches[1]!.closest('[data-ring]'));
  // A grid swatch goes relative under a focus ring; one on a ring keeps the place it was given.
  await settle();
  expect(getComputedStyle(swatches[11]!).position).toBe('absolute');
  expect(rings()[2]!.radiusSpread).toBeLessThan(1);
});

test('on a bottom arc Down moves down the screen, out to the ring below', async () => {
  await mount({ center: 180, direction: 'cw' });
  const basic = screen.getByRole('group', { name: 'Basic' });
  const swatches = [...basic.querySelectorAll<HTMLElement>('[data-swatch]')];
  const y = (el: Element) => el.getBoundingClientRect().top;
  swatches[13]!.focus();
  await userEvent.keyboard('{ArrowDown}');
  const below = document.activeElement as HTMLElement;
  expect(below.closest('[data-ring]')).not.toBe(swatches[13]!.closest('[data-ring]'));
  expect(y(below)).toBeGreaterThan(y(swatches[13]!));
  await userEvent.keyboard('{ArrowUp}');
  expect(document.activeElement).toBe(swatches[13]);
  await userEvent.keyboard('{ArrowRight}');
  expect((document.activeElement as HTMLElement).getBoundingClientRect().left).toBeGreaterThan(swatches[13]!.getBoundingClientRect().left);
});

test('rows past where the arc bends too tight share the last ring that fits, which scrolls', async () => {
  const { spec, rings } = await mount({ size: 300 }, { palettes: 'standard', recent: 0 });
  const read = rings();
  // Radius 134: ring k needs 134 - 24k above the 60 at which two swatches' inner corners meet.
  expect(spec.radius).toBe(134);
  expect(read.map((r) => r.ring)).toEqual([0, 1, 2, 3]);
  // The recent ring, then three of the palette's: the third holds its rows from the third on.
  const last = screen.getByRole('group', { name: 'Standard' }).querySelector('[data-ring="2"]')!;
  expect(last.hasAttribute('data-scrolls')).toBe(true);
  expect(last.querySelectorAll('[data-swatch]')).toHaveLength(80);
});
