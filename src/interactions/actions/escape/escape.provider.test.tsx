import { describe, it, expect, vi } from 'vitest';
import { useEffect } from 'react';
import { render } from '@testing-library/react';
import { useEscape } from './escape';
import { ActionsProvider, useActionsRegistry, type ActionsRegistry } from '../registry';
import { asNodeId } from 'core/scene/types';

describe('useEscape back-compat with ActionsProvider', () => {
  it('registers an action when wrapped in ActionsProvider; unregisters on unmount', () => {
    let regSnap: ActionsRegistry | null = null;
    function Probe() { const r = useActionsRegistry(); useEffect(() => { regSnap = r; }); return null; }
    function Host() {
      useEscape({ getSelection: () => [asNodeId('x')], setSelection: vi.fn() });
      return null;
    }
    const { unmount, rerender } = render(
      <ActionsProvider>
        <Host />
        <Probe />
      </ActionsProvider>,
    );
    expect(regSnap!.list().some(a => a.id === 'escape')).toBe(true);
    rerender(<ActionsProvider><Probe /></ActionsProvider>);
    expect(regSnap!.list().some(a => a.id === 'escape')).toBe(false);
    unmount();
  });

  it('falls back to direct keydown listener when no provider is in scope', () => {
    const setSelection = vi.fn();
    function Host() {
      useEscape({ getSelection: () => [asNodeId('x')], setSelection });
      return null;
    }
    render(<Host />);
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    expect(setSelection).toHaveBeenCalledWith([]);
  });

  it('inside a provider, the registered action carries the default label', () => {
    let regSnap: ActionsRegistry | null = null;
    function Probe() { const r = useActionsRegistry(); useEffect(() => { regSnap = r; }); return null; }
    function Host() {
      useEscape({ getSelection: () => [asNodeId('x')], setSelection: vi.fn() });
      return null;
    }
    render(
      <ActionsProvider>
        <Host />
        <Probe />
      </ActionsProvider>,
    );
    const a = regSnap!.list().find(x => x.id === 'escape')!;
    expect(a.label).toBe('Escape');
  });

  it('imperative clearSelection() return still works inside a provider', () => {
    const setSelection = vi.fn();
    let imperative: (() => void) | undefined;
    function Host() {
      const { clearSelection } = useEscape({ getSelection: () => [asNodeId('x')], setSelection });
      imperative = clearSelection;
      return null;
    }
    render(<ActionsProvider><Host /></ActionsProvider>);
    imperative!();
    expect(setSelection).toHaveBeenCalledWith([]);
  });
});
