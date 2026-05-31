import { describe, it, expect, vi } from 'vitest';
import { render, fireEvent, screen, act } from '@testing-library/react';
import { Select, SelectItem } from './Select';

const OPTIONS = [
  { value: 'r' as const, label: 'Red' },
  { value: 'g' as const, label: 'Green' },
  { value: 'b' as const, label: 'Blue' },
];

describe('Select', () => {
  it('renders a button trigger labeled by the select', () => {
    render(<Select label="Color" options={OPTIONS} placeholder="—" />);
    const trigger = screen.getByRole('button', { name: /Color/ });
    expect(trigger).toBeTruthy();
  });

  it('opens the listbox and selects on click, firing onSelectionChange', () => {
    const onChange = vi.fn();
    render(<Select label="Color" options={OPTIONS} onSelectionChange={onChange} />);
    act(() => { fireEvent.click(screen.getByRole('button', { name: /Color/ })); });
    fireEvent.click(screen.getByRole('option', { name: 'Green' }));
    expect(onChange).toHaveBeenCalledWith('g');
  });

  it('renders the current selection in the trigger value', () => {
    render(<Select label="Color" options={OPTIONS} defaultSelectedKey="b" />);
    expect(screen.getByRole('button', { name: /Blue/ })).toBeTruthy();
  });

  it('supports the children form with explicit SelectItem rows', () => {
    const onChange = vi.fn();
    render(
      <Select label="Color" onSelectionChange={onChange}>
        <SelectItem id="r">Red</SelectItem>
        <SelectItem id="g">Green</SelectItem>
      </Select>,
    );
    act(() => { fireEvent.click(screen.getByRole('button', { name: /Color/ })); });
    fireEvent.click(screen.getByRole('option', { name: 'Red' }));
    expect(onChange).toHaveBeenCalledWith('r');
  });

  it('renders the placeholder when no value selected', () => {
    render(<Select label="Color" options={OPTIONS} placeholder="Pick one" />);
    expect(screen.getByRole('button', { name: /Pick one/ })).toBeTruthy();
  });
});
