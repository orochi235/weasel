import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import type { PrefRenderContext } from '../Prefs';
import { ATTR_RENDERERS } from './attrRenderers';

afterEach(cleanup);

const ctx = (kind: string, value: unknown, setValue = vi.fn()): PrefRenderContext => ({
  path: 'x', pref: { kind, name: 'X', description: '', default: undefined }, value, setValue, auto: false, setAuto: () => {},
});

describe('attribute controls', () => {
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
});
