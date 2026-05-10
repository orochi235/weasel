import { describe, it, expect } from 'vitest';
import { useEffect } from 'react';
import { render } from '@testing-library/react';
import { useFlip } from './flip';
import { ActionsProvider, useActionsRegistry, type ActionsRegistry } from '../registry';
import type { Op } from 'core/ops/types';
import { asNodeId, type NodeId } from 'core/scene/types';

type Pose = { x: number; y: number; width: number; height: number };

function makeAdapter() {
  const batches: { ops: Op[]; label: string }[] = [];
  return {
    getSelection: () => [asNodeId('a')],
    getPose: (_id: NodeId): Pose => ({ x: 0, y: 0, width: 1, height: 1 }),
    applyBatch: (ops: Op[], label?: string) => batches.push({ ops, label: label ?? '' }),
    batches,
  };
}

describe('useFlip back-compat with ActionsProvider', () => {
  it('registers 2 Actions when wrapped in ActionsProvider; unregisters on unmount', () => {
    let regSnap: ActionsRegistry | null = null;
    function Probe() { const r = useActionsRegistry(); useEffect(() => { regSnap = r; }); return null; }
    const adapter = makeAdapter();
    function Host() { useFlip<Pose>(adapter); return null; }
    const { rerender } = render(
      <ActionsProvider>
        <Host />
        <Probe />
      </ActionsProvider>,
    );
    const ids = regSnap!.list().filter(a => a.id.startsWith('flip.')).map(a => a.id).sort();
    expect(ids).toEqual(['flip.horizontal', 'flip.vertical']);
    rerender(<ActionsProvider><Probe /></ActionsProvider>);
    expect(regSnap!.list().filter(a => a.id.startsWith('flip.'))).toHaveLength(0);
  });

  it('falls back to direct keydown listener when no provider is in scope', () => {
    const adapter = makeAdapter();
    function Host() { useFlip<Pose>(adapter); return null; }
    render(<Host />);
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'H', shiftKey: true, bubbles: true }));
    expect(adapter.batches).toHaveLength(1);
  });

  it('imperative flip() return still works inside a provider', () => {
    const adapter = makeAdapter();
    let imperative: ((axis: 'x' | 'y') => void) | undefined;
    function Host() { const { flip } = useFlip<Pose>(adapter); imperative = flip; return null; }
    render(<ActionsProvider><Host /></ActionsProvider>);
    imperative!('x');
    expect(adapter.batches).toHaveLength(1);
  });
});
