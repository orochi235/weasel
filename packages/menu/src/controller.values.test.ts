import { describe, expect, it, vi } from 'vitest';
import { createMenuController } from './controller';
import type { MenuEntry, MenuNumberEntry } from './entries';
import { keyStep } from './keys';
import { menuNumberText } from './numberText';

function setup(value: number | undefined | null = 8, extra: Partial<MenuNumberEntry> = {}) {
  const set = vi.fn();
  const zoom: MenuNumberEntry = { kind: 'number', key: 'zoom', label: 'Zoom', value: value ?? undefined, min: 2, max: 16, step: 1, set, ...extra };
  const entries: MenuEntry[] = [
    { kind: 'item', key: 'cut', label: 'Cut', run: () => {} },
    zoom,
    { kind: 'color', key: 'color', label: 'Color', value: '#336699' },
  ];
  const onClose = vi.fn();
  const c = createMenuController({ entries, onClose });
  return { c, zoom, set, onClose, entries };
}

describe('a number row', () => {
  it('is a row the highlight lands on, and so is a color row', () => {
    const { c } = setup();
    c.key('ArrowDown');
    c.key('ArrowDown');
    expect(c.stack()).toEqual([1]);
    c.key('ArrowDown');
    expect(c.stack()).toEqual([2]);
  });

  it('steps with + and - while highlighted, writes each value, and stays open', () => {
    const { c, zoom, set, onClose } = setup();
    c.hover(0, 1);
    expect(c.key('+')).toBe(true);
    expect(c.key('+')).toBe(true);
    expect(set.mock.calls).toEqual([[9], [10]]);
    expect(c.numberValue(zoom)).toBe(10);
    expect(c.key('-')).toBe(true);
    expect(c.numberValue(zoom)).toBe(9);
    expect(onClose).not.toHaveBeenCalled();
  });

  it('holds a value within its bounds, and writes nothing when a step goes nowhere', () => {
    const { c, zoom, set } = setup(16);
    c.hover(0, 1);
    c.key('=');
    expect(set).not.toHaveBeenCalled();
    c.setNumber(zoom, 40);
    expect(set).not.toHaveBeenCalled();
    c.setNumber(zoom, 0);
    expect(set).toHaveBeenLastCalledWith(2);
    expect(c.numberValue(zoom)).toBe(2);
  });

  it('tells subscribers when a value changes', () => {
    const { c, zoom } = setup();
    const heard = vi.fn();
    c.subscribe(heard);
    c.setNumber(zoom, 12);
    expect(heard).toHaveBeenCalled();
  });

  it('steps by the spin keys a field steps by', () => {
    const { c, zoom } = setup();
    expect(c.spin(zoom, 'PageUp')).toBe(true);
    expect(c.numberValue(zoom)).toBe(16);
    expect(c.spin(zoom, 'Home')).toBe(true);
    expect(c.numberValue(zoom)).toBe(2);
    expect(c.spin(zoom, 'x')).toBe(false);
  });

  it('does not step while disabled, and leaves + to typeahead off a number row', () => {
    const { c, set } = setup(8, { disabled: true });
    c.hover(0, 1);
    c.key('+');
    expect(set).not.toHaveBeenCalled();
    expect(keyStep(setup().entries, [0], '+').handled).toBe(false);
  });

  it('chooses nothing on Enter, and closes on nothing but a dismissal', () => {
    const { c, set, onClose } = setup();
    c.hover(0, 1);
    c.key('Enter');
    c.press(0, 1);
    c.press(0, 2);
    expect(onClose).not.toHaveBeenCalled();
    expect(set).not.toHaveBeenCalled();
  });

  it('starts an unknown value from its lower bound', () => {
    const { c, zoom } = setup(null);
    expect(c.numberValue(zoom)).toBeUndefined();
    c.spin(zoom, 'ArrowUp');
    expect(c.numberValue(zoom)).toBe(3);
  });
});

describe('menuNumberText', () => {
  it('reads a value with its unit, and a dash for none', () => {
    expect(menuNumberText(8, '×')).toBe('8×');
    expect(menuNumberText(0.25)).toBe('0.25');
    expect(menuNumberText(undefined, '×')).toBe('—');
  });
});
