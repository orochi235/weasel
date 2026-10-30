import '@weasel-js/theme/tokens.css';
import 'windease/styles.css';
import '../styles.less';
import { cleanup } from '@testing-library/react';
import { renderWithIcons } from '@weasel-js/ui/testing/withIcons';
import { afterEach, expect, test } from 'vitest';
import type { Instrument } from '../instrument/types';
import { Lab } from '../lab/Lab';

// Whether the strip's readouts take their face's metrics is line layout: a browser's to answer.
// Until the kit's faces arrive, the readouts draw in whatever the stack falls back to.

afterEach(cleanup);

const Painted: Instrument = {
  name: 'Painted',
  defaultConfig: () => ({}),
  initialState: () => ({}),
  canvas: { layers: [{ id: 'fill', draw: () => {} }] },
  render: () => null,
};

const FALLBACKS = ['serif', 'monospace', 'system-ui', "'Helvetica Neue'", "'Arial Narrow'"];

test('a trial’s status strip is as tall in any face as in the numeric one', async () => {
  const root = getComputedStyle(document.documentElement);
  for (const face of ['--wzl-font-numeric', '--wzl-font-ui']) {
    await document.fonts.load(`12px ${root.getPropertyValue(face)}`, '0');
  }
  const { container } = renderWithIcons(
    <Lab instruments={[Painted]} defaultInstrument="Painted" />,
  );
  await expect.poll(() => container.querySelector('.lk-scale-indicator')).not.toBeNull();
  const strip = container.querySelector<HTMLElement>('.lk-trial__status') as HTMLElement;
  const height = () => strip.getBoundingClientRect().height;
  const faced = height();
  expect(faced).toBeGreaterThan(0);

  const heights: Record<string, number> = {};
  for (const face of FALLBACKS) {
    strip.style.setProperty('--wzl-font-numeric', face);
    heights[face] = height();
  }
  expect(heights).toEqual(Object.fromEntries(FALLBACKS.map((f) => [f, faced])));
});
