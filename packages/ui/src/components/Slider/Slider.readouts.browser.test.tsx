import '@weasel-js/theme/tokens.css';
import '@weasel-js/theme/fonts.css';
import { cleanup, render } from '@testing-library/react';
import { afterEach, expect, test } from 'vitest';
import { Slider } from './Slider';

afterEach(cleanup);

async function readouts(values: number[]) {
  const { container } = render(
    <div style={{ width: 300 }}>
      <Slider
        min={0}
        max={100}
        thumbs={values.map((value) => ({ value }))}
        readoutPlacement="below-thumb"
        renderReadout={(t) => `value ${t.value}`}
        onInput={() => {}}
      />
    </div>,
  );
  await document.fonts.ready;
  await new Promise((r) => requestAnimationFrame(r));
  return [...container.querySelectorAll('[data-readout="below"]')].map((e) => e.getBoundingClientRect());
}

const overlap = (a: DOMRect, b: DOMRect) =>
  a.left < b.right && b.left < a.right && a.top < b.bottom && b.top < a.bottom;

test('readouts of thumbs far apart share one row', async () => {
  const [a, b] = await readouts([10, 90]);
  expect(a!.top).toBe(b!.top);
});

test('a readout that would overlap its neighbor steps down a row instead', async () => {
  const rects = await readouts([40, 42, 44, 90]);
  for (let i = 0; i < rects.length; i++)
    for (let j = i + 1; j < rects.length; j++) expect(overlap(rects[i]!, rects[j]!)).toBe(false);
  expect(new Set(rects.slice(0, 3).map((r) => r.top)).size).toBe(3);
  // The far thumb has room on the first row.
  expect(rects[3]!.top).toBe(rects[0]!.top);
});
