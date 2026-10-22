import '@weasel-js/theme/tokens.css';
import '@weasel-js/theme/fonts.css';
import { cleanup, render } from '@testing-library/react';
import { afterEach, expect, test } from 'vitest';
import { page } from 'vitest/browser';
import { arcShape, placeAlongRun, trackRun } from '@weasel-js/geom';
import { arcInBox } from '../arcInBox';
import { CurvedLabelView, LABEL_ARCS } from './CurvedLabelView';

afterEach(cleanup);

const frame = () => new Promise((r) => requestAnimationFrame(r));
const settle = async () => {
  for (let i = 0; i < 6; i++) await frame();
};

const SIZE = 300;
const TEXT = 'Along the arc';

async function mount(text = TEXT) {
  await page.viewport(1200, 900);
  render(<CurvedLabelView config={{ text, size: SIZE, align: 'center' }} />);
  await document.fonts.ready;
  await settle();
}

for (const name of ['top', 'bottom'] as const) {
  test(`${name} arc: each character sits within 1px of its placeAlongRun point, and they read left to right`, async () => {
    await mount();
    const box = document.querySelector<HTMLElement>(`[data-label="${name}"]`)!;
    const origin = box.getBoundingClientRect();
    const spans = [...box.querySelectorAll<HTMLElement>('[data-char]')];
    const run = trackRun(arcShape(arcInBox(LABEL_ARCS[name], { width: SIZE, height: SIZE })));
    const places = placeAlongRun(run, spans.map((el) => el.offsetWidth), { align: 'center' });
    expect(spans).toHaveLength(TEXT.length);
    const centers = spans.map((el) => {
      const r = el.getBoundingClientRect();
      return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
    });
    centers.forEach((c, i) => {
      // The box has a 1px border, which the spans' offset parent excludes.
      const want = { x: origin.left + 1 + places[i]!.point.x, y: origin.top + 1 + places[i]!.point.y };
      expect(Math.hypot(c.x - want.x, c.y - want.y)).toBeLessThanOrEqual(1);
    });
    for (let i = 1; i < centers.length; i++) expect(centers[i]!.x).toBeGreaterThan(centers[i - 1]!.x);
    // Reading means upright too: a tangent turned past a quarter either way would put the text upside down.
    for (const p of places) expect(Math.abs(((((p.angle + 180) % 360) + 360) % 360) - 180)).toBeLessThan(90);
    const meanY = centers.reduce((sum, c) => sum + c.y, 0) / centers.length;
    const middle = origin.top + origin.height / 2;
    if (name === 'bottom') expect(meanY).toBeGreaterThan(middle);
    else expect(meanY).toBeLessThan(middle);
  });
}

test('a combining sequence and a ZWJ emoji each get one span', async () => {
  const text = 'e\u0301 \u{1F469}\u200D\u{1F469}\u200D\u{1F467}';
  await mount(text);
  const count = [...new Intl.Segmenter(undefined, { granularity: 'grapheme' }).segment(text)].length;
  expect(count).toBe(3);
  for (const name of ['top', 'bottom']) expect(document.querySelectorAll(`[data-label="${name}"] [data-char]`)).toHaveLength(count);
});
