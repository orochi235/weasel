import { describe, expect, it, vi } from 'vitest';
import { screen, render } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ComboBox } from './ComboBox';

const OPTIONS = [
  { value: 'r', label: 'Red' },
  { value: 'g', label: 'Green', disabled: true, disabledReason: 'Out of stock' },
  { value: 'b', label: 'Blue' },
];

describe('a ComboBox with a disabled option', () => {
  it('lands its arrow keys on the option, which reads as disabled and says why', async () => {
    const user = userEvent.setup();
    render(<ComboBox label="Color" options={OPTIONS} />);
    const input = screen.getByRole('combobox');
    await user.tab();
    await user.keyboard('{ArrowDown}{ArrowDown}');
    const green = await screen.findByRole('option', { name: 'Green' });
    expect(input.getAttribute('aria-activedescendant')).toBe(green.id);
    expect(green).toHaveAttribute('aria-disabled', 'true');
    expect(green).toHaveAccessibleDescription('Out of stock');
    await user.keyboard('{ArrowDown}');
    expect(input.getAttribute('aria-activedescendant')).toBe(screen.getByRole('option', { name: 'Blue' }).id);
  });

  it('commits nothing on Enter or a click there, and stays open', async () => {
    const user = userEvent.setup();
    const onCommit = vi.fn();
    const onSelectionChange = vi.fn();
    render(<ComboBox label="Color" options={OPTIONS} onCommit={onCommit} onSelectionChange={onSelectionChange} />);
    await user.tab();
    await user.keyboard('{ArrowDown}{ArrowDown}{Enter}');
    await user.click(screen.getByRole('option', { name: 'Green' }));
    expect(onCommit).not.toHaveBeenCalled();
    expect(onSelectionChange).not.toHaveBeenCalled();
    expect(screen.getByRole('listbox')).toBeTruthy();
  });
});
