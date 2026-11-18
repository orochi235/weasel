import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { SwatchGrid, type SwatchGridOption } from './SwatchGrid';

const OPTIONS: SwatchGridOption[] = [
  { id: 'red', value: '#ff0000ff', label: 'Red' },
  { id: 'green', value: '#00ff00ff', label: 'Green' },
  { id: 'blue', value: '#0000ffff', label: 'Blue', disabled: true, disabledReason: 'Every slot is taken' },
  { id: 'gray', value: '#808080ff', label: 'Gray', disabled: true },
];

const swatch = (name: string) => screen.getByRole('button', { name });

function mount(over: Partial<Parameters<typeof SwatchGrid>[0]> = {}) {
  const onSelect = vi.fn();
  render(<SwatchGrid options={OPTIONS} onSelect={onSelect} columns={4} aria-label="Colors" {...over} />);
  return { onSelect };
}

describe('SwatchGrid toggles', () => {
  it('presses every swatch a list of ids names, and marks none current', () => {
    mount({ value: ['red', 'blue'] });
    expect(swatch('Red')).toHaveAttribute('aria-pressed', 'true');
    expect(swatch('Green')).toHaveAttribute('aria-pressed', 'false');
    expect(swatch('Blue')).toHaveAttribute('aria-pressed', 'true');
    expect(swatch('Red')).not.toHaveAttribute('aria-current');
  });

  it('hands a pressed swatch back on click, for the caller to release', () => {
    const { onSelect } = mount({ value: ['red'] });
    fireEvent.click(swatch('Red'));
    expect(onSelect).toHaveBeenCalledWith('red', OPTIONS[0]);
  });

  it('puts the tab stop on the first pressed swatch', () => {
    mount({ value: ['green'] });
    expect(swatch('Green')).toHaveAttribute('tabindex', '0');
    expect(swatch('Red')).toHaveAttribute('tabindex', '-1');
  });

  it('keeps a single value marking one swatch current', () => {
    mount({ value: 'green' });
    expect(swatch('Green')).toHaveAttribute('aria-current', 'true');
    expect(swatch('Green')).not.toHaveAttribute('aria-pressed');
  });
});

describe('SwatchGrid disabled swatches', () => {
  it('applies nothing from a disabled swatch, on click, alt-click, or Shift+Enter', () => {
    const onAltSelect = vi.fn();
    const { onSelect } = mount({ onAltSelect });
    fireEvent.click(swatch('Blue'));
    fireEvent.click(swatch('Gray'), { shiftKey: true });
    fireEvent.contextMenu(swatch('Blue'));
    fireEvent.keyDown(swatch('Blue'), { key: 'Enter', shiftKey: true });
    expect(onSelect).not.toHaveBeenCalled();
    expect(onAltSelect).not.toHaveBeenCalled();
  });

  it('stays reachable, marked disabled, and says why', () => {
    mount();
    expect(swatch('Blue')).toHaveAttribute('aria-disabled', 'true');
    expect(swatch('Blue')).not.toBeDisabled();
    expect(swatch('Blue')).toHaveAccessibleDescription('Every slot is taken');
    expect(swatch('Gray')).toHaveAttribute('aria-disabled', 'true');
    swatch('Green').focus();
    fireEvent.keyDown(swatch('Green'), { key: 'ArrowRight' });
    expect(swatch('Blue')).toHaveFocus();
  });

  it('leaves the rest applying', () => {
    const { onSelect } = mount();
    fireEvent.click(swatch('Green'));
    expect(onSelect).toHaveBeenCalledWith('green', OPTIONS[1]);
  });
});

describe('SwatchGrid onHoverChange', () => {
  it('reports the swatch under the pointer or focus, and null as the pointer leaves', () => {
    const onHoverChange = vi.fn();
    mount({ onHoverChange });
    fireEvent.pointerEnter(swatch('Red'));
    fireEvent.focus(swatch('Green'));
    fireEvent.pointerLeave(screen.getByRole('group', { name: 'Colors' }));
    expect(onHoverChange.mock.calls).toEqual([[OPTIONS[0]], [OPTIONS[1]], [null]]);
  });
});
