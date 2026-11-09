import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { PropertyField } from './PropertyField';

const options = [
  { value: 'sm', label: 'Small', description: 'Fits a phone' },
  { value: 'lg', label: 'Large', disabled: true, disabledReason: 'Needs a wider page' },
];

describe('an enum option says what it is, and why it is disabled', () => {
  it('in a radio group, as each choice\'s description, kept out of its name', () => {
    render(<PropertyField kind="enum" control="radio" label="Size" value="sm" options={options} onChange={() => {}} />);
    expect(screen.getByRole('radio', { name: 'Small' })).toHaveAccessibleDescription('Fits a phone');
    expect(screen.getByRole('radio', { name: 'Large' })).toHaveAccessibleDescription('Needs a wider page');
  });

  it('in a menu, as each row\'s description', () => {
    render(<PropertyField kind="enum" control="menu" label="Size" value={undefined} options={options} onChange={() => {}} />);
    fireEvent.click(screen.getByRole('button'), { detail: 1 });
    const [small, large] = screen.getAllByRole('menuitem');
    expect(small).toHaveAccessibleDescription(expect.stringContaining('Fits a phone'));
    expect(large).toHaveAccessibleDescription(expect.stringContaining('Needs a wider page'));
  });

  it('in a select, as each row\'s description', () => {
    render(<PropertyField kind="enum" control="select" label="Size" value="sm" options={options} onChange={() => {}} />);
    fireEvent.click(screen.getByRole('button'));
    expect(screen.getByRole('option', { name: 'Small' })).toHaveAccessibleDescription('Fits a phone');
    expect(screen.getByRole('option', { name: 'Large' })).toHaveAccessibleDescription('Needs a wider page');
  });
});
