import '@weasel-js/theme/tokens.css';
import { cleanup, render } from '@testing-library/react';
import { afterEach, expect, test } from 'vitest';
import { Slider } from './Slider';

afterEach(cleanup);

test('a press on a stop mark lands on the track beneath it, not on the mark', () => {
  const { container } = render(
    <div style={{ width: 300 }}>
      <Slider min={0} max={100} stops={[0, 50, 100]} thumbs={[{ value: 10 }]} onInput={() => {}} />
    </div>,
  );
  const mark = container.querySelector('[data-slider-tick][data-fraction="0.5"]')!.getBoundingClientRect();
  expect(mark.width).toBeGreaterThan(0);
  expect(mark.height).toBeGreaterThan(0);
  const hit = document.elementFromPoint(mark.left + mark.width / 2, mark.top + mark.height / 2)!;
  expect(hit.closest('[data-slider-ticks]')).toBeNull();
  expect(container.querySelector('[data-slider-rail]')!.parentElement!.contains(hit)).toBe(true);
});
