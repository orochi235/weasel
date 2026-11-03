import '@weasel-js/theme/tokens.css';
import '@weasel-js/theme/fonts.css';
import { cleanup, render } from '@testing-library/react';
import { useState } from 'react';
import { afterEach, expect, test } from 'vitest';
import { userEvent } from 'vitest/browser';
import { decomposePatternTransform } from '@weasel-js/core';
import type { PatternPaint as PatternFill } from '@weasel-js/core';
import { IDLE_SETTLE_MS } from '@weasel-js/ui';
import { PatternPicker, seedPattern } from '@weasel-js/ui/components/PatternPicker';

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

test.each([
  ['before typing rests', 0],
  ['after typing rests', IDLE_SETTLE_MS * 2],
])('the rotation field reads a typed degree sign, Enter pressed %s', async (_, pause) => {
  const seen: PatternFill[] = [];
  function Controlled() {
    const [value, setValue] = useState<PatternFill>(() => seedPattern('hatch', '#123456'));
    return (
      <PatternPicker
        value={value}
        color="#123456"
        onChange={(next) => {
          seen.push(next);
          setValue(next);
        }}
      />
    );
  }
  const { getByRole } = render(<Controlled />);
  const input = getByRole('spinbutton', { name: 'Rotation' }) as HTMLInputElement;
  input.focus();
  await userEvent.fill(input, '20°');
  await new Promise((resolve) => setTimeout(resolve, pause));
  await userEvent.keyboard('{Enter}');
  expect(seen).toHaveLength(1);
  expect(decomposePatternTransform(seen[0].transform).rotation).toBeCloseTo((20 * Math.PI) / 180, 9);
});
