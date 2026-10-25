import '@weasel-js/theme/tokens.css';
import '@weasel-js/theme/fonts.css';
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, expect, test } from 'vitest';
import { SEGMENTS_ARC_DEFAULTS, SegmentsArcView } from '../ToggleBar/lab/SegmentsArcView';

afterEach(cleanup);

const frame = () => new Promise((r) => requestAnimationFrame(r));

async function settle() {
  let last = '';
  for (let i = 0; i < 30; i++) {
    await frame();
    const now = [...document.querySelectorAll('[data-run-text-bend] path')].map((el) => el.getAttribute('d')).join('|');
    if (now !== '' && now === last) return;
    last = now;
  }
}

/** The client point of each glyph's start on its baseline. */
function glyphs(text: SVGTextElement): DOMPoint[] {
  const m = text.getScreenCTM()!;
  return Array.from({ length: text.getNumberOfChars() }, (_, i) => text.getStartPositionOfChar(i).matrixTransform(m));
}

function circle() {
  const box = screen.getByRole('radiogroup', { name: 'Tool' }).parentElement!.parentElement!.getBoundingClientRect();
  return { x: box.left + box.width / 2, y: box.top + box.height / 2 };
}

test('every label on an arc is drawn along a circle concentric with it, where its own text sits', async () => {
  render(<SegmentsArcView config={SEGMENTS_ARC_DEFAULTS} />);
  await settle();
  const c = circle();
  const bends = [...document.querySelectorAll<HTMLElement>('[data-run-text-bend]')];
  expect(bends.length).toBeGreaterThan(2);
  for (const bend of bends) {
    const text = bend.querySelector('text')!;
    const label = bend.previousSibling as Text;
    expect(text.textContent).toBe(label.data);
    expect(getComputedStyle(label.parentElement!).webkitTextFillColor).toBe('rgba(0, 0, 0, 0)');
    const radii = glyphs(text).map((p) => Math.hypot(p.x - c.x, p.y - c.y));
    for (const r of radii) expect(r).toBeCloseTo(radii[0]!, 0);
    // The copy is centered where the hidden text is.
    const range = document.createRange();
    range.selectNodeContents(label);
    const was = range.getBoundingClientRect();
    const now = text.getBoundingClientRect();
    expect(Math.abs(now.left + now.width / 2 - (was.left + was.width / 2))).toBeLessThan(1.5);
    expect(Math.abs(now.top + now.height / 2 - (was.top + was.height / 2))).toBeLessThan(1.5);
  }
});
