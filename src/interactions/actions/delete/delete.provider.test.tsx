import { describe, it, expect } from 'vitest';
import { useEffect } from 'react';
import { render } from '@testing-library/react';
import { useDelete } from './delete';
import type { DeleteAdapter } from './delete';
import { ActionsProvider, useActionsRegistry, type ActionsRegistry } from '../registry';
import type { Op } from 'core/ops/types';
import { asNodeId, type NodeId } from 'core/scene/types';

function makeAdapter() {
  const batches: { ops: Op[]; label: string }[] = [];
  const adapter: DeleteAdapter = {
    getSelection: () => [asNodeId('a')],
    getNode: (id) => ({ id }),
    setSelection: () => {},
    applyOps: (ops, label) => { batches.push({ ops, label }); },
  };
  return { adapter, batches };
}

describe('useDelete back-compat with ActionsProvider', () => {
  it('registers a `delete` action when wrapped in ActionsProvider; unregisters on unmount', () => {
    let regSnap: ActionsRegistry | null = null;
    function Probe() { const r = useActionsRegistry(); useEffect(() => { regSnap = r; }); return null; }
    const { adapter } = makeAdapter();
    function Host() { useDelete(adapter); return null; }
    const { unmount, rerender } = render(
      <ActionsProvider>
        <Host />
        <Probe />
      </ActionsProvider>,
    );
    expect(regSnap!.list().some((a) => a.id === 'delete')).toBe(true);
    rerender(<ActionsProvider><Probe /></ActionsProvider>);
    expect(regSnap!.list().some((a) => a.id === 'delete')).toBe(false);
    unmount();
  });

  it('the registered `delete` action carries its label and binding', () => {
    let regSnap: ActionsRegistry | null = null;
    function Probe() { const r = useActionsRegistry(); useEffect(() => { regSnap = r; }); return null; }
    const { adapter } = makeAdapter();
    function Host() { useDelete(adapter); return null; }
    render(<ActionsProvider><Host /><Probe /></ActionsProvider>);
    const a = regSnap!.list().find((x) => x.id === 'delete')!;
    expect(a.label).toBe('Delete');
    expect(a.defaultBinding).toEqual({ key: ['Delete', 'Backspace'] });
  });

  it('document Delete fires exactly once inside a provider (registry owns dispatch, no double-fire)', () => {
    const helpers = makeAdapter();
    function Host() { useDelete(helpers.adapter); return null; }
    render(<ActionsProvider><Host /></ActionsProvider>);
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Delete', bubbles: true, cancelable: true }));
    expect(helpers.batches).toHaveLength(1);
  });

  it('falls back to direct keydown listener when no provider is in scope', () => {
    const helpers = makeAdapter();
    function Host() { useDelete(helpers.adapter); return null; }
    render(<Host />);
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Delete', bubbles: true, cancelable: true }));
    expect(helpers.batches).toHaveLength(1);
  });

  it('enableKeyboard: false skips registration', () => {
    let regSnap: ActionsRegistry | null = null;
    function Probe() { const r = useActionsRegistry(); useEffect(() => { regSnap = r; }); return null; }
    const { adapter } = makeAdapter();
    function Host() { useDelete(adapter, { enableKeyboard: false }); return null; }
    render(<ActionsProvider><Host /><Probe /></ActionsProvider>);
    expect(regSnap!.list().some((a) => a.id === 'delete')).toBe(false);
  });

  it('imperative deleteSelection() works inside a provider', () => {
    const helpers = makeAdapter();
    let imperative: (() => NodeId[]) | undefined;
    function Host() { const { deleteSelection } = useDelete(helpers.adapter); imperative = deleteSelection; return null; }
    render(<ActionsProvider><Host /></ActionsProvider>);
    imperative!();
    expect(helpers.batches).toHaveLength(1);
  });
});
