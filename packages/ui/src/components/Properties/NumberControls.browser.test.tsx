import '@weasel-js/theme/tokens.css';
import { cleanup, render, screen } from '@testing-library/react';
import { endless, unit } from '@weasel-js/quantity';
import { afterEach, expect, test } from 'vitest';
import { PropertyField } from './PropertyField';
import { PropertyList } from './PropertyPanel';

// Whether a readout's box holds its text is layout, which jsdom does not do.

afterEach(cleanup);

test.each([
  ['never', 5000, endless(unit('ms'), 'never')],
  ['uncapped', 64, endless(unit('ms'), 'uncapped')],
])('a readout at an endless end is wide enough for %s', (word, max, display) => {
  render(
    <PropertyList>
      <PropertyField kind="number" control="slider" label="End" value={Infinity} min={0} max={max} step={8} display={display} endless="max" onChange={() => {}} />
    </PropertyList>,
  );
  const readout = screen.getByRole('spinbutton', { name: 'End' }) as HTMLInputElement;
  expect(readout.value).toBe(word);
  expect(readout.scrollWidth).toBeLessThanOrEqual(readout.clientWidth);
});
