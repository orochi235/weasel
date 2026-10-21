import '@weasel-js/theme/tokens.css';
import '@weasel-js/theme/fonts.css';
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, expect, test } from 'vitest';
import { page, userEvent } from 'vitest/browser';
import { arcShape, trackRun, type Point } from '@weasel-js/geom';
import { arcInBox } from '../../Along/arcInBox';
import { arcOf, SLIDER_ARC_SCHEMA, type SliderArcConfig } from './sliderArcSchema';
import { SliderArcView } from './SliderArcView';

afterEach(cleanup);

const frame = () => new Promise((r) => requestAnimationFrame(r));
const settle = async () => {
  for (let i = 0; i < 6; i++) await frame();
};

/** The lab's defaults with `patch`'s groups merged over them. */
function configWith(patch: { [K in keyof SliderArcConfig]?: Partial<SliderArcConfig[K]> }): SliderArcConfig {
  const base = SLIDER_ARC_SCHEMA.defaults() as SliderArcConfig;
  return Object.fromEntries(Object.entries(base).map(([k, v]) => [k, { ...v, ...patch[k as keyof SliderArcConfig] }])) as unknown as SliderArcConfig;
}

async function mount(config: SliderArcConfig) {
  await page.viewport(1200, 900);
  render(<SliderArcView config={config} onPreset={() => {}} />);
  await document.fonts.ready;
  await settle();
  const twin = (name: 'curved' | 'straight') => document.querySelector<HTMLElement>(`[data-twin="${name}"]`)!;
  const thumb = (name: 'curved' | 'straight') => screen.getByRole('slider', { name: name === 'curved' ? 'Curved' : 'Straight' });
  return { twin, thumb };
}

const opts = (p: Point, buttons = 1) => ({ bubbles: true, pointerId: 1, pointerType: 'mouse', isPrimary: true, button: 0, buttons, clientX: p.x, clientY: p.y });

/** A press and release on whatever is at client point `p`. */
async function press(p: Point) {
  const target = document.elementFromPoint(p.x, p.y)!;
  target.dispatchEvent(new PointerEvent('pointerdown', opts(p)));
  await frame();
  document.dispatchEvent(new PointerEvent('pointerup', opts(p, 0)));
  await settle();
}

/** The client point at fraction `g` of the curved twin's value span: the arc less half a thumb at each end. */
function curvedAt(config: SliderArcConfig, box: HTMLElement, thumb: HTMLElement, g: number): Point {
  const shape = arcShape(arcInBox(arcOf(config.arc), { width: config.arc.size, height: config.arc.size }));
  const i = Math.min(0.5, thumb.offsetWidth / 2 / shape.length);
  const { point } = trackRun(shape, i, 1 - i).at(g);
  const r = box.getBoundingClientRect();
  return { x: r.left + point.x, y: r.top + point.y };
}

/** The client point at fraction `g` of the straight twin's value span: along its rail. */
function straightAt(box: HTMLElement, g: number): Point {
  const r = box.querySelector('[data-slider-rail]')!.getBoundingClientRect();
  return { x: r.left + g * r.width, y: r.top + r.height / 2 };
}

const FRACTIONS = [0, 0.13, 0.37, 0.5, 0.71, 0.92, 1];

test.each([
  ['linear, magnetic stops', configWith({ values: { link: false } })],
  ['even, strict detents', configWith({ values: { link: false, min: 2, max: 16 }, stops: { set: 'uneven', snap: 'strict', spacing: 'even' } })],
  ['fine, no stops, on the right side', configWith({ values: { link: false, max: 1, step: 0.01 }, stops: { set: 'none' }, arc: { start: 30, end: 150, direction: 'cw' } })],
])('a press at the same fraction of either twin’s span gives the same value: %s', async (_, config) => {
  const { twin, thumb } = await mount(config);
  for (const g of FRACTIONS) {
    const p = curvedAt(config, twin('curved'), thumb('curved'), g);
    expect(document.elementFromPoint(p.x, p.y)?.closest('[data-twin]')).toBe(twin('curved'));
    await press(p);
    await press(straightAt(twin('straight'), g));
    expect(thumb('curved').getAttribute('aria-valuenow'), `at ${g}`).toBe(thumb('straight').getAttribute('aria-valuenow'));
  }
});

test('the same keys on either twin land on the same value', async () => {
  const { thumb } = await mount(configWith({ values: { link: false } }));
  for (const name of ['curved', 'straight'] as const) {
    thumb(name).focus();
    await userEvent.keyboard('{Home}{ArrowRight}{ArrowRight}{ArrowRight}{PageUp}{ArrowLeft}');
  }
  await settle();
  expect(thumb('curved').getAttribute('aria-valuenow')).toBe(thumb('straight').getAttribute('aria-valuenow'));
  expect(Number(thumb('curved').getAttribute('aria-valuenow'))).toBeGreaterThan(0);
});

test('the lab’s readouts are what the page shows: the same values, the thumb on the arc, the straight one untilted', async () => {
  const { thumb } = await mount(configWith({}));
  const cell = (id: string) => document.querySelector(`[data-readout="${id}"] td`)!.textContent!.trim();
  await press(curvedAt(configWith({}), document.querySelector('[data-twin="curved"]')!, thumb('curved'), 0.8));
  expect(cell('curved-value-0')).toBe(thumb('curved').getAttribute('aria-valuenow'));
  // Linked, a press on one twin moves both.
  expect(cell('straight-value-0')).toBe(cell('curved-value-0'));
  expect(cell('agree')).toBe('yes');
  expect(Number.parseFloat(cell('curved-off-0'))).toBeLessThanOrEqual(1);
  expect(Number.parseFloat(cell('straight-angle-0'))).toBe(0);
  expect(Math.abs(Number.parseFloat(cell('curved-angle-0')))).toBeGreaterThan(5);
});
