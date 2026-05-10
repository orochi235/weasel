import { describe, it, expect, vi } from 'vitest';
import { useEffect } from 'react';
import { render } from '@testing-library/react';
import { useSelectAll } from './select-all';
import { ActionsProvider, useActionsRegistry, type ActionsRegistry } from '../registry';
import { asNodeId } from 'core/scene/types';

describe('useSelectAll back-compat with ActionsProvider', () => {
  it('registers an action when wrapped in ActionsProvider; unregisters on unmount', () => {
    let regSnap: ActionsRegistry | null = null;
    function Probe() { const r = useActionsRegistry(); useEffect(() => { regSnap = r; }); return null; }
    function Host() {
      useSelectAll({ getSelection: () => [], listAll: () => [asNodeId('a')], setSelection: vi.fn() });
      return null;
    }
    const { unmount, rerender } = render(
      <ActionsProvider>
        <Host />
        <Probe />
      </ActionsProvider>,
    );
    expect(regSnap!.list().some(a => a.id === 'selectAll')).toBe(true);
    rerender(<ActionsProvider><Probe /></ActionsProvider>);
    expect(regSnap!.list().some(a => a.id === 'selectAll')).toBe(false);
    unmount();
  });

  it('falls back to direct keydown listener when no provider is in scope', () => {
    const setSelection = vi.fn();
    function Host() {
      useSelectAll({ getSelection: () => [], listAll: () => [asNodeId('a'), asNodeId('b')], setSelection });
      return null;
    }
    render(<Host />);
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'a', metaKey: true, bubbles: true }));
    expect(setSelection).toHaveBeenCalledWith(['a', 'b']);
  });

  it('inside a provider, the registered action carries the default label', () => {
    let regSnap: ActionsRegistry | null = null;
    function Probe() { const r = useActionsRegistry(); useEffect(() => { regSnap = r; }); return null; }
    function Host() {
      useSelectAll({ getSelection: () => [], listAll: () => [asNodeId('hookOnly')], setSelection: vi.fn() });
      return null;
    }
    render(
      <ActionsProvider>
        <Host />
        <Probe />
      </ActionsProvider>,
    );
    const a = regSnap!.list().find(x => x.id === 'selectAll')!;
    expect(a.label).toBe('Select All');
  });

  it('imperative selectAll() return still works inside a provider', () => {
    const setSelection = vi.fn();
    let imperative: (() => void) | undefined;
    function Host() {
      const { selectAll } = useSelectAll({
        getSelection: () => [], listAll: () => [asNodeId('a')],
        setSelection,
      });
      imperative = selectAll;
      return null;
    }
    render(<ActionsProvider><Host /></ActionsProvider>);
    imperative!();
    expect(setSelection).toHaveBeenCalledWith(['a']);
  });
});
