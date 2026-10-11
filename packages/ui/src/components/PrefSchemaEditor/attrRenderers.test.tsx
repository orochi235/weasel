import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import type { PrefRenderContext } from '../Prefs';
import { ATTR_RENDERERS } from './attrRenderers';

afterEach(cleanup);

const ctx = (kind: string, value: unknown, setValue = vi.fn()): PrefRenderContext => ({
  path: 'x', pref: { kind, name: 'X', description: '', default: undefined }, value, setValue, auto: false, setAuto: () => {},
});

describe('attribute controls', () => {
  it('marks the option list and the pair editor, each several controls, as groups a label may not wrap', () => {
    expect(ATTR_RENDERERS['enum-options'].group).toBe(true);
    expect(ATTR_RENDERERS.pair.group).toBe(true);
    expect(ATTR_RENDERERS.symbol.group).toBeUndefined();
  });

  it('optional-number writes a number, and undefined when cleared', () => {
    const setValue = vi.fn();
    render(<>{ATTR_RENDERERS['optional-number'](ctx('optional-number', 4, setValue))}</>);
    const box = screen.getByRole('textbox', { name: 'X' });
    fireEvent.change(box, { target: { value: '12' } });
    fireEvent.blur(box);
    expect(setValue).toHaveBeenLastCalledWith(12);
    fireEvent.change(box, { target: { value: '' } });
    fireEvent.blur(box);
    expect(setValue).toHaveBeenLastCalledWith(undefined);
  });

  it('enum-options edits a value and adds a row', () => {
    const setValue = vi.fn();
    render(<>{ATTR_RENDERERS['enum-options'](ctx('enum-options', [{ value: 'a', label: 'A' }], setValue))}</>);
    fireEvent.change(screen.getByRole('textbox', { name: 'Option 1 value' }), { target: { value: 'b' } });
    expect(setValue).toHaveBeenLastCalledWith([{ value: 'b', label: 'A' }]);
    fireEvent.click(screen.getByRole('button', { name: 'Add option' }));
    expect(setValue).toHaveBeenLastCalledWith([{ value: 'a', label: 'A' }, { value: '', label: '' }]);
  });

  it('enum-options flags a value that is empty or repeats an earlier one, and still takes the edit', () => {
    const setValue = vi.fn();
    const rows = [{ value: 'a', label: 'A' }, { value: '', label: '' }, { value: 'a', label: 'Again' }];
    render(<>{ATTR_RENDERERS['enum-options'](ctx('enum-options', rows, setValue))}</>);
    const value = (n: number) => screen.getByRole('textbox', { name: `Option ${n} value` });
    expect(value(1)).not.toHaveAttribute('aria-invalid');
    expect(value(2)).toHaveAttribute('aria-invalid', 'true');
    expect(value(2)).toHaveAccessibleDescription('Value is empty');
    expect(value(3)).toHaveAttribute('aria-invalid', 'true');
    expect(value(3)).toHaveAccessibleDescription('Repeats an earlier value');
    expect(screen.getByRole('textbox', { name: 'Option 2 label' })).not.toHaveAttribute('aria-invalid');
    fireEvent.change(value(3), { target: { value: 'a' } });
    fireEvent.change(value(3), { target: { value: 'ab' } });
    expect(setValue).toHaveBeenLastCalledWith([rows[0], rows[1], { value: 'ab', label: 'Again' }]);
  });
});
