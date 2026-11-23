import '@weasel-js/theme/tokens.css';
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, expect, test } from 'vitest';
import { ComboBox } from '@weasel-js/ui/components/ComboBox';

afterEach(cleanup);

const OPTIONS = [
  { value: 'r', label: 'Red' },
  { value: 'g', label: 'Green' },
];

test.each(['fill', 'fit'] as const)('a width="%s" combo box keeps its height while loading', (width) => {
  const { rerender } = render(<ComboBox aria-label="Color" options={OPTIONS} width={width} />);
  const frame = screen.getByRole('combobox').parentElement!;
  const idle = frame.getBoundingClientRect().height;
  rerender(<ComboBox aria-label="Color" options={OPTIONS} width={width} loading />);
  expect(frame.getBoundingClientRect().height).toBe(idle);
});
