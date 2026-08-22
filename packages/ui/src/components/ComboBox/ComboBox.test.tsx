import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ComboBox, ComboBoxItem } from './ComboBox';

const OPTIONS = [
  { value: 'r' as const, label: 'Red' },
  { value: 'g' as const, label: 'Green' },
  { value: 'b' as const, label: 'Blue' },
];

describe('ComboBox', () => {
  it('renders a combobox-role input', () => {
    render(<ComboBox label="Color" options={OPTIONS} placeholder="Pick" />);
    const input = screen.getByRole('combobox') as HTMLInputElement;
    expect(input).toBeInstanceOf(HTMLInputElement);
    expect(input.placeholder).toBe('Pick');
  });

  it('renders the open button', () => {
    render(<ComboBox label="Color" options={OPTIONS} />);
    expect(screen.getByRole('button', { name: /Show options/ })).toBeTruthy();
  });

  it('shows the current selection as the input value', () => {
    render(<ComboBox label="Color" options={OPTIONS} defaultSelectedKey="g" />);
    expect((screen.getByRole('combobox') as HTMLInputElement).value).toBe('Green');
  });

  it('clears the input when a controlled selectedKey goes null', () => {
    const { rerender } = render(
      <ComboBox label="Color" options={OPTIONS} selectedKey="g" onSelectionChange={() => {}} />,
    );
    expect((screen.getByRole('combobox') as HTMLInputElement).value).toBe('Green');
    rerender(<ComboBox label="Color" options={OPTIONS} selectedKey={null} onSelectionChange={() => {}} />);
    expect((screen.getByRole('combobox') as HTMLInputElement).value).toBe('');
  });

  it('supports the children form with explicit items', () => {
    render(
      <ComboBox label="Color">
        <ComboBoxItem id="r">Red</ComboBoxItem>
        <ComboBoxItem id="g">Green</ComboBoxItem>
      </ComboBox>,
    );
    expect(screen.getByRole('combobox')).toBeTruthy();
  });
});
