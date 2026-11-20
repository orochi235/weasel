import { describe, expect, it } from 'vitest';
import { act, render } from '@testing-library/react';
import { key } from '@weasel-js/gestures';
import { ActionsProvider, useActionsRegistry } from '../interactions/actions/ActionsProvider';
import type { ActionsRegistry } from '../interactions/actions/registry';
import { DepRegistryProvider, useDepSource } from '../interactions/actions/depRegistry';
import { createKeymapStack } from './keymapStack';
import { useOpenKeymap } from './useOpenKeymap';
import type { KeymapDescription } from './describeKeymap';

describe('useOpenKeymap', () => {
  it('follows an override and a relabel while the keymap stays open', () => {
    const stack = createKeymapStack();
    let registry: ActionsRegistry | undefined;
    let seen: KeymapDescription | null = null;
    function Probe() {
      useDepSource('keymaps', () => stack);
      registry = useActionsRegistry()!;
      seen = useOpenKeymap();
      return null;
    }
    render(<DepRegistryProvider><ActionsProvider><Probe /></ActionsProvider></DepRegistryProvider>);
    act(() => {
      registry!.register({ id: 'zoom', label: 'Zoom' });
      stack.push('loupe', 'Loupe', { bindings: [{ spec: key('2'), actionId: 'zoom' }] });
    });
    expect(seen!.rows.map((r) => [r.shortcut?.key, r.label])).toEqual([['Escape', 'Close'], ['2', 'Zoom']]);

    act(() => { registry!.overrideBindings({ 'loupe#0': key('3') }); });
    expect(seen!.rows[1]!.shortcut?.key).toBe('3');

    act(() => { registry!.register({ id: 'zoom', label: 'Zoom in' }); });
    expect(seen!.rows[1]!.label).toBe('Zoom in');
  });
});
