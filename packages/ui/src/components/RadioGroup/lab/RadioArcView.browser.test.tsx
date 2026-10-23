import '@weasel-js/theme/tokens.css';
import '@weasel-js/theme/fonts.css';
import { cleanup, render, within } from '@testing-library/react';
import { afterEach, expect, test } from 'vitest';
import { page, userEvent } from 'vitest/browser';
import { arcShape, trackRun, type Point } from '@weasel-js/geom';
import { arcInBox } from '../../Along/arcInBox';
import { RADIO_ARC_DEFAULTS, radioArcs, RadioArcView } from './RadioArcView';

afterEach(cleanup);

const frame = () => new Promise((r) => requestAnimationFrame(r));
async function settle() {
  let last = '';
  for (let i = 0; i < 30; i++) {
    await frame();
    const now = [...document.querySelectorAll('[style]')].map((el) => el.getAttribute('style')).join('|');
    if (now === last) return;
    last = now;
  }
}

async function mount(invalid = false) {
  await page.viewport(1200, 900);
  const config = { ...RADIO_ARC_DEFAULTS, invalid };
  render(<RadioArcView config={config} />);
  await document.fonts.ready;
  await settle();
  const box = document.querySelector<HTMLElement>('[data-lab-box="radios"]')!;
  const arcs = radioArcs(config);
  const runOf = (which: 'top' | 'bottom') => trackRun(arcShape(arcInBox(arcs[which], { width: config.size, height: config.size })));
  const centerIn = (el: Element): Point => {
    const b = box.getBoundingClientRect();
    const r = el.getBoundingClientRect();
    return { x: r.left + r.width / 2 - b.left, y: r.top + r.height / 2 - b.top };
  };
  return { box, runOf, centerIn, center: { x: config.size / 2, y: config.size / 2 } };
}

const groups = () => [...document.querySelectorAll<HTMLElement>('[role="radiogroup"]')];
/** The group's parts on the run in run order: its label, then each radio's. */
const labelsIn = (group: HTMLElement) => [...group.querySelectorAll<HTMLElement>('[data-run-slot]')];
const dist = (a: Point, b: Point) => Math.hypot(a.x - b.x, a.y - b.y);

for (const [i, which] of (['top', 'bottom'] as const).entries()) {
  test(`${which} arc: the label leads and the radios follow it on the run, left to right, upright`, async () => {
    const { runOf, centerIn } = await mount();
    const run = runOf(which);
    const parts = labelsIn(groups()[i]!);
    expect(parts[0]!.textContent).toBe(which === 'top' ? 'Top' : 'Bottom');
    const centers = parts.map(centerIn);
    for (const c of centers) expect(run.nearest(c).dist).toBeLessThanOrEqual(1);
    for (let k = 1; k < centers.length; k++) expect(centers[k]!.x).toBeGreaterThan(centers[k - 1]!.x);
    for (const label of parts.slice(1)) {
      const dot = label.querySelector('[class*="dot"]')!.getBoundingClientRect();
      const text = label.lastElementChild!.getBoundingClientRect();
      // Upright: the dot reads before its text, left of it across the run.
      expect(text.left + text.width / 2).toBeGreaterThan(dot.left + dot.width / 2);
    }
  });

  test(`${which} arc: the description and error sit inside the bend, past the radios' inner edge, and clear of them`, async () => {
    const { runOf, centerIn, center } = await mount(true);
    const group = groups()[i]!;
    const run = runOf(which);
    const radius = dist(run.at(0.5).point, center);
    const middle = run.at(0.5).point;
    const radio = labelsIn(group).slice(1).sort((a, b) => dist(centerIn(a), middle) - dist(centerIn(b), middle))[0]!;
    const hint = group.querySelector<HTMLElement>('[data-radio-hint]')!;
    expect(within(hint).getByText('Not in stock')).toBeVisible();
    const h = hint.getBoundingClientRect();
    const r = radio.getBoundingClientRect();
    expect(dist(centerIn(hint), center)).toBeLessThan(radius - radio.offsetHeight / 2);
    // Clear of the radio nearest the middle: below it on a top arc, above it on a bottom one.
    if (which === 'top') expect(h.top).toBeGreaterThanOrEqual(r.bottom - 1);
    else expect(h.bottom).toBeLessThanOrEqual(r.top + 1);
  });
}

test('the arrow keys choose along the arc in reading order', async () => {
  await mount();
  const top = groups()[0]!;
  const radios = within(top).getAllByRole('radio');
  // The input is visually hidden; its label is what takes the press.
  await userEvent.click(within(top).getByText('Small'));
  await userEvent.keyboard('{ArrowRight}');
  expect(radios[1]).toBeChecked();
  expect(document.querySelector('[data-readout="top"] td')!.textContent).toBe('Medium');
});
