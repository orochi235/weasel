import '@weasel-js/theme/tokens.css';
import '@weasel-js/theme/fonts.css';
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, expect, test } from 'vitest';
import { SEGMENTS_ARC_DEFAULTS, SegmentsArcView } from './SegmentsArcView';

afterEach(cleanup);

const frame = () => new Promise((r) => requestAnimationFrame(r));

/** Frames until the segments stop moving: their lengths are measured after the first paint. */
async function settle() {
  let last = '';
  for (let i = 0; i < 30; i++) {
    await frame();
    const now = [...document.querySelectorAll('[data-segment], [data-lit]')].map((el) => el.getAttribute('style') ?? el.getAttribute('d')).join('|');
    if (now === last) return;
    last = now;
  }
}

const center = (el: Element) => {
  const r = el.getBoundingClientRect();
  return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
};

/** The circle the lab's Alongs share, in client px. */
function circle() {
  const box = screen.getByRole('radiogroup', { name: 'Tool' }).parentElement!.parentElement!.getBoundingClientRect();
  return { x: box.left + box.width / 2, y: box.top + box.height / 2, r: box.width / 2 - 24 };
}

/** The rotation in degrees an element's transform tips it by. */
const tipOf = (el: Element) => {
  const m = new DOMMatrix(getComputedStyle(el).transform);
  return (Math.atan2(m.b, m.a) * 180) / Math.PI;
};

test('segments sit on the arc, edge to edge, and the well runs one rim past the first and last', async () => {
  render(<SegmentsArcView config={SEGMENTS_ARC_DEFAULTS} />);
  await settle();
  const c = circle();
  const radios = screen.getAllByRole('radio').filter((el) => el.closest('[aria-label="Tool"]'));
  const lengths = radios.map((el) => (el as HTMLElement).offsetWidth);
  const angles = radios.map((el) => {
    const p = center(el);
    expect(Math.hypot(p.x - c.x, p.y - c.y)).toBeCloseTo(c.r, 0);
    return Math.atan2(p.y - c.y, p.x - c.x);
  });
  for (let i = 1; i < radios.length; i++) expect((angles[i]! - angles[i - 1]!) * c.r).toBeCloseTo((lengths[i - 1]! + lengths[i]!) / 2, 0);
  const well = screen.getByRole('radiogroup', { name: 'Tool' }).querySelector<SVGPathElement>('svg > path')!;
  const pad = Number.parseFloat(getComputedStyle(screen.getByRole('radiogroup', { name: 'Tool' })).paddingInlineStart);
  expect(well.getTotalLength()).toBeCloseTo(lengths.reduce((a, b) => a + b, 0) + 2 * pad, 0);
});

test('a press on a segment reaches its button over the well, and lights it', async () => {
  render(<SegmentsArcView config={SEGMENTS_ARC_DEFAULTS} />);
  await settle();
  const rotate = screen.getByRole('radio', { name: 'Rotate' });
  const p = center(rotate);
  expect(document.elementFromPoint(p.x, p.y)).toBe(rotate);
  rotate.click();
  await settle();
  expect(rotate).toHaveAttribute('aria-checked', 'true');
  const lit = screen.getByRole('radiogroup', { name: 'Tool' }).querySelector<SVGPathElement>('[data-lit="on"]')!;
  // The lit stroke passes through the segment it lights.
  const local = lit.ownerSVGElement!.getBoundingClientRect();
  const q = new DOMPoint(p.x - local.left, p.y - local.top);
  expect(lit.isPointInStroke(q)).toBe(true);
});

test('a bar on the bottom arc reads upright', async () => {
  render(<SegmentsArcView config={SEGMENTS_ARC_DEFAULTS} />);
  await settle();
  for (const name of ['Bold', 'Italic', 'Under']) {
    const tip = tipOf(screen.getByRole('button', { name }));
    expect(Math.abs(tip)).toBeLessThan(90);
  }
});
