import '@weasel-js/theme/tokens.css';
import '@weasel-js/theme/fonts.css';
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, expect, test } from 'vitest';
import { Along, type RunAlign } from './Along';
import { ToggleBar } from './ToggleBar';

afterEach(cleanup);

const frame = () => new Promise((r) => requestAnimationFrame(r));

async function settle() {
  let last = '';
  for (let i = 0; i < 30; i++) {
    await frame();
    const now = [...document.querySelectorAll('[data-segment], svg path')].map((el) => el.getAttribute('style') ?? el.getAttribute('d')).join('|');
    if (now === last) return;
    last = now;
  }
}

const WORDS = ['Left', 'Center', 'Right', 'Justify'];

interface Case {
  align: RunAlign;
  direction: 'cw' | 'ccw';
  span: number;
  lit: 'first' | 'last';
}

function Bar({ c }: { c: Case }) {
  const value = c.lit === 'first' ? WORDS[0]! : WORDS[WORDS.length - 1]!;
  return (
    <div style={{ position: 'relative', width: 280, height: 280 }}>
      <Along arc={{ at: 0, span: `${c.span}deg`, direction: c.direction }} align={c.align}>
        <ToggleBar ariaLabel="Alignment" items={WORDS.map((w) => ({ value: w, label: w }))} value={value} onChange={() => {}} />
      </Along>
    </div>
  );
}

/** The end of `path` at `end`, and the unit direction pointing out of it. */
function endOf(path: SVGPathElement, end: 'lo' | 'hi') {
  const total = path.getTotalLength();
  const [a, b] = end === 'lo' ? [path.getPointAtLength(1), path.getPointAtLength(0)] : [path.getPointAtLength(total - 1), path.getPointAtLength(total)];
  const n = Math.hypot(b.x - a.x, b.y - a.y);
  return { at: b, out: { x: (b.x - a.x) / n, y: (b.y - a.y) / n } };
}

const cases: Case[] = [];
for (const align of ['start', 'center', 'end'] as const)
  for (const direction of ['cw', 'ccw'] as const)
    for (const span of [180, 300])
      for (const lit of ['first', 'last'] as const) cases.push({ align, direction, span, lit });

test.each(cases)('a lit end segment fills the well round its cap: %o', async (c) => {
  render(<Bar c={c} />);
  await settle();
  const group = screen.getByRole('radiogroup', { name: 'Alignment' });
  const well = group.querySelector<SVGPathElement>('svg path[class*="wellTrack"]')!;
  const rim = group.querySelector<SVGPathElement>('mask path')!;
  const lit = group.querySelector<SVGPathElement>('[data-lit="on"]')!;
  const r = Number.parseFloat(getComputedStyle(rim).strokeWidth) / 2;
  const { at, out } = endOf(well, c.lit === 'first' ? 'lo' : 'hi');
  // Inside the rim's round cap, past the well's end: lit, as on a straight bar.
  for (const k of [0.3, 0.7]) {
    const p = new DOMPoint(at.x + out.x * r * k, at.y + out.y * r * k);
    expect(lit.isPointInStroke(p), `${k} of the cap`).toBe(true);
  }
  const pad = Number.parseFloat(getComputedStyle(group).paddingInlineStart);
  const lengths = WORDS.map((w) => screen.getByRole('radio', { name: w }).offsetWidth);
  expect(well.getTotalLength()).toBeCloseTo(lengths.reduce((a, b) => a + b, 0) + 2 * pad, 0);
});

test('a scrolled row ends its well one rim past the run, and a lit segment at that end fills its cap', async () => {
  render(<Bar c={{ align: 'center', direction: 'cw', span: 40, lit: 'first' }} />);
  await settle();
  const group = screen.getByRole('radiogroup', { name: 'Alignment' });
  expect(group).toHaveAttribute('data-scrolls');
  const well = group.querySelector<SVGPathElement>('svg path[class*="wellTrack"]')!;
  const rim = group.querySelector<SVGPathElement>('mask path')!;
  const lit = group.querySelector<SVGPathElement>('[data-lit="on"]')!;
  const r = Number.parseFloat(getComputedStyle(rim).strokeWidth) / 2;
  const { at, out } = endOf(well, 'lo');
  expect(lit.isPointInStroke(new DOMPoint(at.x + out.x * r * 0.5, at.y + out.y * r * 0.5))).toBe(true);
  const pad = Number.parseFloat(getComputedStyle(group).paddingInlineStart);
  const run = group.querySelector<SVGPathElement>('svg path[class*="bandPath"]')!.getTotalLength();
  expect(well.getTotalLength()).toBeCloseTo(run + 2 * pad, 0);
});
