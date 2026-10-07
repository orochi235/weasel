import '@weasel-js/theme/tokens.css';
import '@weasel-js/theme/fonts.css';
import { cleanup, render } from '@testing-library/react';
import { afterEach, expect, test } from 'vitest';
import { Slider } from './Slider';

afterEach(cleanup);

async function layout(labels: string[]) {
  const { container } = render(
    <div style={{ width: 300 }}>
      <Slider
        min={0}
        max={labels.length - 1}
        stops={labels.map((label, value) => ({ value, label }))}
        thumbs={[{ value: 1 }]}
        onInput={() => {}}
      />
    </div>,
  );
  await document.fonts.ready;
  const track = container.querySelector('[data-slider-rail]')!.parentElement!.getBoundingClientRect();
  const ticks = [...container.querySelectorAll('[data-slider-tick]')].map((e) => {
    const r = e.getBoundingClientRect();
    return r.left + r.width / 2;
  });
  const labelRects = [...container.querySelectorAll('[data-slider-stop-label]')].map((e) => e.getBoundingClientRect());
  return { track, ticks, labelRects };
}

const center = (r: DOMRect) => r.left + r.width / 2;

test('an end label narrow enough to fit centers on its tick', async () => {
  const { ticks, labelRects } = await layout(['1', 'two', 'three', '4']);
  expect(center(labelRects[0]) - ticks[0]).toBeCloseTo(0, 1);
  expect(center(labelRects[3]) - ticks[3]).toBeCloseTo(0, 1);
});

test('a wide end label moves in only as far as the track edge', async () => {
  const { track, ticks, labelRects } = await layout(['0.25×', 'b', 'c', 'quadruple']);
  const [first, last] = [labelRects[0], labelRects[3]];
  expect(first.left).toBeGreaterThanOrEqual(track.left - 0.5);
  expect(last.right).toBeLessThanOrEqual(track.right + 0.5);
  // Pulled in by the overflow alone, not pinned flush to its tick.
  expect(first.left).toBeLessThan(ticks[0] - 1);
  expect(last.right).toBeGreaterThan(ticks[3] + 1);
});
