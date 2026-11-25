import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { expect, it, vi } from 'vitest';
import { PropertyControl, PropertyField } from './PropertyField';

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

it('writes nothing when a readout showing a rounded value is focused and left untouched', async () => {
  const onChange = vi.fn();
  render(<PropertyField kind="number" control="slider" label="Width" value={0.37} min={0} max={100} onChange={onChange} />);
  const readout = screen.getByRole('spinbutton', { name: 'Width' });
  await userEvent.click(readout);
  await userEvent.tab();
  expect(onChange).not.toHaveBeenCalled();
});

it('leaves the track in the tab order while there is no value for the readout to edit', () => {
  render(<PropertyField kind="number" control="slider" label="Width" value={undefined} min={0} max={100} onChange={vi.fn()} />);
  expect(screen.getByRole('slider', { name: 'Width' })).not.toHaveAttribute('tabindex', '-1');
});

it('keeps a standalone slider disabled for a reason reachable through its readout, described by the reason', () => {
  render(<PropertyControl kind="number" control="slider" name="Blur" value={4} min={0} max={10} disabled disabledReason="Locked" onChange={() => {}} />);
  const readout = screen.getByRole('spinbutton', { name: 'Blur' });
  expect(readout).not.toBeDisabled();
  expect(readout).toHaveAttribute('aria-disabled', 'true');
  expect(readout).toHaveAccessibleDescription('Locked');
});

it('keeps the caret after a typed minus sign', async () => {
  const { readout } = slider();
  await userEvent.click(readout);
  await userEvent.keyboard('{End}');
  readout.setSelectionRange(0, 0);
  await userEvent.keyboard('-');
  expect(readout.value).toBe('−20');
  expect(readout.selectionStart).toBe(1);
});
