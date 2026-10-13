import '@weasel-js/theme/tokens.css';
import '@weasel-js/theme/fonts.css';
import { cleanup, render } from '@testing-library/react';
import { afterEach, expect, test } from 'vitest';
import { userEvent } from 'vitest/browser';
import { decomposePatternTransform } from '@weasel-js/core';
import type { PatternPaint as PatternFill } from '@weasel-js/core';
import { PatternPicker, seedPattern } from './PatternPicker';

afterEach(cleanup);

test('the rotation field sits beside its label, no wider than it needs', async () => {
  const { getByRole, getByText } = render(
    <div style={{ width: 240 }}>
      <PatternPicker value={seedPattern('hatch', '#123456')} color="#123456" onChange={() => {}} />
    </div>,
  );
  await document.fonts.ready;
  const label = getByText('Rotation').getBoundingClientRect();
  const frame = (getByRole('spinbutton', { name: 'Rotation' }).parentElement as HTMLElement).getBoundingClientRect();
  expect(frame.left).toBeGreaterThanOrEqual(label.right);
  expect(frame.top).toBeLessThan(label.bottom);
  expect(frame.bottom).toBeGreaterThan(label.top);
  expect(frame.width).toBeLessThan(140);
  expect(frame.width).toBeGreaterThan(40);
});

test('the rotation field reads a typed degree sign', async () => {
  const seen: PatternFill[] = [];
  const { getByRole } = render(
    <PatternPicker
      value={seedPattern('hatch', '#123456')}
      color="#123456"
      onChange={(next) => seen.push(next)}
    />,
  );
  const input = getByRole('spinbutton', { name: 'Rotation' }) as HTMLInputElement;
  input.focus();
  await userEvent.fill(input, '20°');
  await userEvent.keyboard('{Enter}');
  expect(seen).toHaveLength(1);
  expect(decomposePatternTransform(seen[0].transform).rotation).toBeCloseTo((20 * Math.PI) / 180, 9);
});
