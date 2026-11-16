import '@weasel-js/theme/tokens.css';
import { cleanup, render, screen } from '@testing-library/react';
import { useState } from 'react';
import { afterEach, expect, test } from 'vitest';
import { CheckboxGroup } from '@weasel-js/ui/components/CheckboxGroup';
import { sweepAcross } from '@weasel-js/ui/testing/sweep';

// A sweep reaches a box by hit-testing the pointer against the laid-out labels, and the native box and React Aria's
// switch each take the press their own way, so whether a drag lands on each box, and only once, takes real layout.

afterEach(cleanup);

const NAMES = ['anchors', 'handles', 'bounds', 'hit areas'];

function Group({ control, orientation }: { control: 'checkbox' | 'switch'; orientation: 'vertical' | 'horizontal' }) {
  const [value, setValue] = useState<string[]>([]);
  return (
    <CheckboxGroup aria-label="Overlays" control={control} orientation={orientation} sweep
      items={NAMES.map((name) => ({ value: name, label: name }))} value={value} onChange={setValue} />
  );
}

test.each([
  ['checkbox', 'vertical'],
  ['switch', 'vertical'],
  ['checkbox', 'horizontal'],
  ['switch', 'horizontal'],
] as const)('a drag across %s boxes laid out %s turns on each one it reaches, and an Alt-drag solos', (control, orientation) => {
  render(<Group control={control} orientation={orientation} />);
  const boxes = screen.getAllByRole(control) as HTMLInputElement[];
  sweepAcross(boxes.slice(0, 3));
  expect(boxes.map((b) => b.checked)).toEqual([true, true, true, false]);
  sweepAcross(boxes.slice(0, 2), { altKey: true });
  expect(boxes.map((b) => b.checked)).toEqual([true, true, false, false]);
});
