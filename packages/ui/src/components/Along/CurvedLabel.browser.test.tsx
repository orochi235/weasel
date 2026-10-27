import '@weasel-js/theme/tokens.css';
import '@weasel-js/theme/fonts.css';
import { cleanup, render } from '@testing-library/react';
import { afterEach, expect, test } from 'vitest';
import { page } from 'vitest/browser';
import { arcShape, lineShape, placeAlongRun, trackRun, type PlaceAlongRunOptions, type TrackShape } from '@weasel-js/geom';
import { arcInBox } from './arcInBox';
import { CurvedLabel, type CurvedLabelProps } from './CurvedLabel';
import type { AlongArc } from './alongContext';

afterEach(cleanup);

const frame = () => new Promise((r) => requestAnimationFrame(r));
const settle = async () => {
  for (let i = 0; i < 6; i++) await frame();
};

const SIZE = 300;
const TEXT = 'Along the arc';
const ARCS: Record<'top' | 'bottom', AlongArc> = {
  top: { start: 270, end: 90, inset: 20 },
  bottom: { start: 270, end: 90, direction: 'ccw', inset: 20 },
};

async function mount(props: CurvedLabelProps): Promise<HTMLElement> {
  await page.viewport(1200, 900);
  const { container } = render(
    <div style={{ position: 'relative', width: SIZE, height: SIZE, fontSize: 20, lineHeight: 1 }}>
      <CurvedLabel {...props} />
    </div>,
  );
  await document.fonts.ready;
  await settle();
  return container.querySelector<HTMLElement>('[role="img"]')!;
}

/** Each span's center on screen, and where `placeAlongRun` puts it along `shape` laid with `options`. */
function compare(label: HTMLElement, shape: TrackShape, options: PlaceAlongRunOptions) {
  const origin = label.getBoundingClientRect();
  const spans = [...label.querySelectorAll<HTMLElement>('span')];
  const places = placeAlongRun(trackRun(shape), spans.map((el) => el.offsetWidth), options);
  const centers = spans.map((el) => {
    const r = el.getBoundingClientRect();
    return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
  });
  return { origin, spans, places, centers, misses: centers.map((c, i) => Math.hypot(c.x - origin.left - places[i]!.point.x, c.y - origin.top - places[i]!.point.y)) };
}

for (const name of ['top', 'bottom'] as const) {
  test(`${name} arc: each character sits within 1px of its placeAlongRun point, and they read left to right`, async () => {
    const label = await mount({ text: TEXT, arc: ARCS[name] });
    const { origin, spans, places, centers, misses } = compare(label, arcShape(arcInBox(ARCS[name], { width: SIZE, height: SIZE })), { align: 'center' });
    expect(spans).toHaveLength(TEXT.length);
    for (const miss of misses) expect(miss).toBeLessThanOrEqual(1);
    for (let i = 1; i < centers.length; i++) expect(centers[i]!.x).toBeGreaterThan(centers[i - 1]!.x);
    // Reading means upright too: a tangent turned past a quarter either way would put the text upside down.
    for (const p of places) expect(Math.abs(((((p.angle + 180) % 360) + 360) % 360) - 180)).toBeLessThan(90);
    const meanY = centers.reduce((sum, c) => sum + c.y, 0) / centers.length;
    const middle = origin.top + origin.height / 2;
    if (name === 'bottom') expect(meanY).toBeGreaterThan(middle);
    else expect(meanY).toBeLessThan(middle);
  });
}

test('align, offset and shift reach placeAlongRun', async () => {
  const options = { align: 'start', offset: -30, shift: 12 } as const;
  const label = await mount({ text: TEXT, arc: ARCS.top, ...options });
  const { misses } = compare(label, arcShape(arcInBox(ARCS.top, { width: SIZE, height: SIZE })), options);
  for (const miss of misses) expect(miss).toBeLessThanOrEqual(1);
});

test('a shape built from the box wins over the arc', async () => {
  const line = (box: { width: number; height: number }) => lineShape({ x: 20, y: box.height - 40 }, { x: box.width - 20, y: 40 });
  const label = await mount({ text: TEXT, arc: ARCS.bottom, shape: line });
  const { misses } = compare(label, line({ width: SIZE, height: SIZE }), { align: 'center' });
  for (const miss of misses) expect(miss).toBeLessThanOrEqual(1);
});

test('names itself by its text, and gives a combining sequence and a ZWJ emoji one span each', async () => {
  const text = 'é \u{1F469}‍\u{1F469}‍\u{1F467}';
  const label = await mount({ text });
  expect(label.getAttribute('aria-label')).toBe(text);
  expect(label.querySelectorAll('span')).toHaveLength(3);
});

test('an Arabic word is shaped joined: narrower than its letters set apart', async () => {
  const width = async (text: string) => {
    const w = [...(await mount({ text })).querySelectorAll<HTMLElement>('span')].reduce((sum, el) => sum + el.offsetWidth, 0);
    cleanup();
    return w;
  };
  // Beh's isolated form carries its whole bowl; at the start or in the middle of a word it is a short tooth.
  expect(await width('ببب')).toBeLessThan(3 * (await width('ب')) * 0.8);
});
