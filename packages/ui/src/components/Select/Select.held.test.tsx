import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { Select } from './Select';

afterEach(cleanup);

const OPTIONS = [
  { value: 'r', label: 'Red' },
  { value: 'g', label: 'Green', disabled: true, disabledReason: 'Out of stock' },
  { value: 'b', label: 'Blue' },
];

function openList(onChange = vi.fn()) {
  render(<Select aria-label="Color" options={OPTIONS} defaultSelectedKey="r" onSelectionChange={onChange} />);
  const trigger = screen.getByRole('button', { name: /Color/ });
  act(() => trigger.focus());
  act(() => { fireEvent.keyDown(trigger, { key: 'ArrowDown' }); });
  act(() => { fireEvent.keyUp(trigger, { key: 'ArrowDown' }); });
  return { onChange, list: screen.getByRole('listbox') };
}

const key = (el: Element, k: string) => {
  act(() => { fireEvent.keyDown(el, { key: k }); });
  act(() => { fireEvent.keyUp(el, { key: k }); });
};

describe('a Select with a disabled option', () => {
  it('lands its arrow keys on the option, which reads as disabled and says why', () => {
    openList();
    expect(document.activeElement).toBe(screen.getByRole('option', { name: 'Red' }));
    key(document.activeElement!, 'ArrowDown');
    const green = screen.getByRole('option', { name: 'Green' });
    expect(document.activeElement).toBe(green);
    expect(green).toHaveAttribute('aria-disabled', 'true');
    expect(green).toHaveAccessibleDescription('Out of stock');
    key(green, 'ArrowDown');
    expect(document.activeElement).toBe(screen.getByRole('option', { name: 'Blue' }));
  });

  it('chooses nothing on Enter or a click there, and stays open', () => {
    const { onChange } = openList();
    key(document.activeElement!, 'ArrowDown');
    const green = screen.getByRole('option', { name: 'Green' });
    key(green, 'Enter');
    fireEvent.click(green);
    expect(onChange).not.toHaveBeenCalled();
    expect(screen.getByRole('listbox')).toBeTruthy();
  });

  it("passes over it with the closed trigger's arrow keys, which change the value", () => {
    const onChange = vi.fn();
    render(<Select aria-label="Color" options={OPTIONS} defaultSelectedKey="r" onSelectionChange={onChange} />);
    const trigger = screen.getByRole('button', { name: /Color/ });
    act(() => trigger.focus());
    key(trigger, 'ArrowRight');
    expect(trigger).toHaveTextContent('Blue');
    expect(onChange).toHaveBeenCalledWith('b');
    key(trigger, 'ArrowLeft');
    expect(trigger).toHaveTextContent('Red');
  });

  it('changes nothing when typeahead on the closed trigger lands on it', () => {
    const onChange = vi.fn();
    render(<Select aria-label="Color" options={OPTIONS} defaultSelectedKey="r" onSelectionChange={onChange} />);
    const trigger = screen.getByRole('button', { name: /Color/ });
    act(() => trigger.focus());
    key(trigger, 'g');
    expect(trigger).toHaveTextContent('Red');
    expect(onChange).not.toHaveBeenCalled();
  });

  it("steps from no value on a mixed select's closed trigger, past a disabled first option", () => {
    const onChange = vi.fn();
    const options = [
      { value: 'g', label: 'Green', disabled: true },
      { value: 'r', label: 'Red' },
      { value: 'b', label: 'Blue' },
    ];
    render(<Select aria-label="Color" options={options} mixed selectedKey="b" onSelectionChange={onChange} />);
    const trigger = screen.getByRole('button', { name: /Color/ });
    act(() => trigger.focus());
    key(trigger, 'ArrowRight');
    expect(onChange).toHaveBeenLastCalledWith('r');
    key(trigger, 'ArrowLeft');
    expect(onChange).toHaveBeenCalledTimes(2);
    expect(onChange).toHaveBeenLastCalledWith('r');
  });
});
