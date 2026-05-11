import { describe, it, expect } from 'vitest';
import { useEffect } from 'react';
import { render } from '@testing-library/react';
import { useDuplicate } from './duplicate';
import { ActionsProvider, useActionsRegistry, type ActionsRegistry } from '../registry';
import type { Op } from 'core/ops/types';
import { asNodeId, type NodeId } from 'core/scene/types';

type Pose = { x: number; y: number };

function makeAdapter() {
  const batches: { ops: Op[]; label: string }[] = [];
  return {
    getSelection: () => [asNodeId('a')],
    getPose: (_id: NodeId): Pose => ({ x: 0, y: 0 }),
    cloneNode: (id: NodeId) => ({ id: asNodeId(id + "'") }),
    applyBatch: (ops: Op[], label?: string) => batches.push({ ops, label: label ?? '' }),
    batches,
  };
}

describe('useDuplicate back-compat with ActionsProvider', () => {
  it('registers an action when wrapped in ActionsProvider; unregisters on unmount', () => {
    let regSnap: ActionsRegistry | null = null;
    function Probe() { const r = useActionsRegistry(); useEffect(() => { regSnap = r; }); return null; }
    const adapter = makeAdapter();
    function Host() { useDuplicate<Pose>(adapter); return null; }
    const { unmount, rerender } = render(
      <ActionsProvider>
        <Host />
        <Probe />
      </ActionsProvider>,
    );
    expect(regSnap!.list().some(a => a.id === 'duplicate')).toBe(true);
    rerender(<ActionsProvider><Probe /></ActionsProvider>);
    expect(regSnap!.list().some(a => a.id === 'duplicate')).toBe(false);
    unmount();
  });

  it('falls back to direct keydown listener when no provider is in scope', () => {
    const adapter = makeAdapter();
    function Host() { useDuplicate<Pose>(adapter); return null; }
    render(<Host />);
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'd', metaKey: true, bubbles: true }));
    expect(adapter.batches).toHaveLength(1);
  });

  it('inside a provider, the registered action carries the default label', () => {
    let regSnap: ActionsRegistry | null = null;
    function Probe() { const r = useActionsRegistry(); useEffect(() => { regSnap = r; }); return null; }
    const adapter = makeAdapter();
    function Host() { useDuplicate<Pose>(adapter); return null; }
    render(<ActionsProvider><Host /><Probe /></ActionsProvider>);
    const a = regSnap!.list().find(x => x.id === 'duplicate')!;
    expect(a.label).toBe('Duplicate');
  });

  it('imperative duplicate() return still works inside a provider', () => {
    const adapter = makeAdapter();
    let imperative: (() => void) | undefined;
    function Host() { const { duplicate } = useDuplicate<Pose>(adapter); imperative = duplicate; return null; }
    render(<ActionsProvider><Host /></ActionsProvider>);
    imperative!();
    expect(adapter.batches).toHaveLength(1);
  });
});
