import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import type { PrefGroup } from '@weasel-js/prefs';
import { PrefsForm } from './index';

afterEach(cleanup);

const SCHEMA: PrefGroup = {
  name: 'Prefs',
  children: {
    a: { kind: 'string', name: 'Alpha', description: '', default: '' },
    b: { kind: 'string', name: 'Beta', description: '', default: '' },
    c: { kind: 'string', name: 'Gamma', description: '', default: '' },
  },
};
const rowOf = (label: string) => screen.getByText(label).closest('[data-pref-path]')!;
const form = (selected: readonly string[], onSelect = vi.fn()) => {
  render(<PrefsForm schema={SCHEMA} values={{}} onChange={vi.fn()} layout="list" selected={selected} onSelect={onSelect} />);
  return onSelect;
};

describe('PrefsForm selection', () => {
  it('marks every selected row', () => {
    form(['a', 'c']);
    expect(rowOf('Alpha')).toHaveAttribute('data-selected');
    expect(rowOf('Beta')).not.toHaveAttribute('data-selected');
    expect(rowOf('Gamma')).toHaveAttribute('data-selected');
  });

  it('reports a plain press as a pick and a Cmd or Ctrl press as a toggle', () => {
    const onSelect = form(['a']);
    fireEvent.pointerDown(rowOf('Beta'));
    expect(onSelect).toHaveBeenLastCalledWith('b', { toggle: false });
    fireEvent.pointerDown(rowOf('Gamma'), { metaKey: true });
    expect(onSelect).toHaveBeenLastCalledWith('c', { toggle: true });
    fireEvent.pointerDown(rowOf('Alpha'), { ctrlKey: true });
    expect(onSelect).toHaveBeenLastCalledWith('a', { toggle: true });
  });

  it('does not report the focus that follows a press on the same row', () => {
    const onSelect = form(['a', 'b']);
    fireEvent.pointerDown(rowOf('Gamma'), { metaKey: true });
    fireEvent.focus(screen.getByRole('textbox', { name: 'Gamma' }));
    expect(onSelect).toHaveBeenCalledTimes(1);
  });

  it('reports a focus that arrives without a press', () => {
    const onSelect = form(['a']);
    fireEvent.focus(screen.getByRole('textbox', { name: 'Gamma' }));
    expect(onSelect).toHaveBeenLastCalledWith('c', { toggle: false });
  });

  it('holds a press on one of several selected rows until the click, then picks that row alone', () => {
    const onSelect = form(['a', 'b']);
    fireEvent.pointerDown(rowOf('Alpha'));
    expect(onSelect).not.toHaveBeenCalled();
    fireEvent.click(rowOf('Alpha'));
    expect(onSelect).toHaveBeenLastCalledWith('a', { toggle: false });
  });

  it('reports nothing for a press on the only selected row', () => {
    const onSelect = form(['a']);
    fireEvent.pointerDown(rowOf('Alpha'));
    fireEvent.click(rowOf('Alpha'));
    expect(onSelect).not.toHaveBeenCalled();
  });
});
