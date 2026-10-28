import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, screen } from '@testing-library/react';
import type { PrefRenderContext } from '../Prefs';
import { ATTR_RENDERERS } from './attrRenderers';
import { renderWithIcons } from '../../testing/withIcons';

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

  it('icon says when the selection holds several icons', () => {
    renderWithIcons(<>{ATTR_RENDERERS.icon({ ...ctx('icon', undefined), mixed: true })}</>);
    expect(screen.getByText('Mixed')).toBeTruthy();
  });

  it('optional-number writes a number, and undefined when cleared', () => {
    const setValue = vi.fn();
    renderWithIcons(<>{ATTR_RENDERERS['optional-number'](ctx('optional-number', 4, setValue))}</>);
    const box = screen.getByRole('textbox', { name: 'X' });
    fireEvent.change(box, { target: { value: '12' } });
    fireEvent.blur(box);
    expect(setValue).toHaveBeenLastCalledWith(12);
    fireEvent.change(box, { target: { value: '' } });
    fireEvent.blur(box);
    expect(setValue).toHaveBeenLastCalledWith(undefined);
  });

  it('enum-options shows each option by its label, edits one in its popover, and adds one as typed', () => {
    const setValue = vi.fn();
    renderWithIcons(<>{ATTR_RENDERERS['enum-options'](ctx('enum-options', [{ value: 'a', label: 'A' }], setValue))}</>);
    fireEvent.click(screen.getByRole('button', { name: 'A' }));
    fireEvent.change(screen.getByRole('textbox', { name: 'Value stored' }), { target: { value: 'b' } });
    expect(setValue).toHaveBeenLastCalledWith([{ value: 'b', label: 'A' }]);
    fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Escape' });
    const add = screen.getByRole('textbox', { name: 'Add to Options' });
    fireEvent.change(add, { target: { value: 'c' } });
    fireEvent.keyDown(add, { key: 'Enter' });
    expect(setValue).toHaveBeenLastCalledWith([{ value: 'a', label: 'A' }, { value: 'c', label: 'c' }]);
  });

  it('enum-options flags a value that is empty or repeats an earlier one, and still takes the edit', () => {
    const setValue = vi.fn();
    const rows = [{ value: 'a', label: 'A' }, { value: '', label: '' }, { value: 'a', label: 'Again' }];
    renderWithIcons(<>{ATTR_RENDERERS['enum-options'](ctx('enum-options', rows, setValue))}</>);
    expect(screen.getByRole('button', { name: 'A' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Empty, Value is empty' })).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Again, Repeats an earlier value' }));
    const value = screen.getByRole('textbox', { name: 'Value stored' });
    expect(value).toHaveAttribute('aria-invalid', 'true');
    expect(value).toHaveAccessibleDescription('Repeats an earlier value');
    fireEvent.change(value, { target: { value: 'ab' } });
    expect(setValue).toHaveBeenLastCalledWith([rows[0], rows[1], { value: 'ab', label: 'Again' }]);
  });
});
