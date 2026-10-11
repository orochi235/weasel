import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { expect, it, vi } from 'vitest';
import { PropertyField } from './PropertyField';

function slider() {
  const onChange = vi.fn();
  render(<PropertyField kind="number" control="slider" label="Width" value={20} min={0} max={100} onChange={onChange} />);
  return { onChange, readout: screen.getByRole('spinbutton', { name: 'Width' }) as HTMLInputElement };
}

it('writes nothing when a typed readout is left with Escape', async () => {
  const { onChange, readout } = slider();
  await userEvent.click(readout);
  await userEvent.keyboard('50{Escape}');
  expect(readout).not.toHaveFocus();
  expect(onChange).not.toHaveBeenCalled();
  expect(readout.value).toBe('20');
});

it('writes a typed readout once on Enter', async () => {
  const { onChange, readout } = slider();
  await userEvent.click(readout);
  await userEvent.keyboard('50{Enter}');
  expect(readout).not.toHaveFocus();
  expect(onChange.mock.calls).toEqual([[50]]);
});

it('writes a typed readout once when focus leaves it', async () => {
  const { onChange, readout } = slider();
  await userEvent.click(readout);
  await userEvent.keyboard('50');
  await userEvent.tab();
  expect(onChange.mock.calls).toEqual([[50]]);
});
