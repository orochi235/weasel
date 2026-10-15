import { fireEvent, render, screen } from '@testing-library/react';
import { expect, it, vi } from 'vitest';
import { PropertyField } from './PropertyField';

it('commits a typed number once, on Enter, not per keystroke', () => {
  const onChange = vi.fn();
  render(<PropertyField kind="number" label="X" value={1} onChange={onChange} />);
  const field = screen.getByRole('spinbutton', { name: 'X' });
  fireEvent.focus(field);
  for (const text of ['1', '15', '150']) fireEvent.change(field, { target: { value: text } });
  expect(onChange).not.toHaveBeenCalled();
  fireEvent.keyDown(field, { key: 'Enter' });
  fireEvent.blur(field);
  expect(onChange.mock.calls).toEqual([[150]]);
});

it('still steps a typed number at once', () => {
  const onChange = vi.fn();
  render(<PropertyField kind="number" label="X" value={1} onChange={onChange} />);
  fireEvent.keyDown(screen.getByRole('spinbutton', { name: 'X' }), { key: 'ArrowUp' });
  expect(onChange.mock.calls).toEqual([[2]]);
});

it('commits typed text once, on blur, not per keystroke', () => {
  const onChange = vi.fn();
  render(<PropertyField kind="string" label="Name" value="a" onChange={onChange} />);
  const field = screen.getByRole('textbox', { name: 'Name' });
  for (const text of ['ab', 'abc']) fireEvent.change(field, { target: { value: text } });
  expect(onChange).not.toHaveBeenCalled();
  fireEvent.blur(field);
  expect(onChange.mock.calls).toEqual([['abc']]);
});
