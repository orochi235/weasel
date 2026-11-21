import { fireEvent, render, screen } from '@testing-library/react';
import { expect, it } from 'vitest';
import { RADIO_ARC_DEFAULTS, RadioArcView } from './RadioArcView';

it('moves a pick the radios no longer offer onto the last one they do', () => {
  const { rerender } = render(<RadioArcView config={{ ...RADIO_ARC_DEFAULTS, choices: 4 }} />);
  const top = screen.getByRole('radiogroup', { name: 'Top' });
  fireEvent.click(top.querySelector('input[value="Huge"]')!);
  rerender(<RadioArcView config={{ ...RADIO_ARC_DEFAULTS, choices: 3 }} />);
  const checked = screen.getByRole('radiogroup', { name: 'Top' }).querySelector<HTMLInputElement>('input:checked');
  expect(checked?.value).toBe('Large');
  expect(screen.queryByText('Huge')).toBeNull();
});
