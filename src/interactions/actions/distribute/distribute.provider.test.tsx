import { describe, it, expect } from 'vitest';
import { useEffect } from 'react';
import { render } from '@testing-library/react';
import { useDistribute } from './distribute';
import { ActionsProvider, useActionsRegistry, type ActionsRegistry } from '../registry';
import type { Op } from 'core/ops/types';
import { asNodeId, type NodeId } from 'core/scene/types';

type Pose = { x: number; y: number; width: number; height: number };

function makeAdapter(initialIds: string[] = ['a', 'b', 'c']) {
  const batches: { ops: Op[]; label: string }[] = [];
  const poses: Record<string, Pose> = {
    a: { x: 0, y: 0, width: 10, height: 10 },
    b: { x: 30, y: 0, width: 10, height: 10 },
    c: { x: 100, y: 0, width: 10, height: 10 },
  };
  return {
    getSelection: () => initialIds.map(asNodeId),
    getPose: (id: NodeId): Pose => poses[id as unknown as string] ?? { x: 0, y: 0, width: 0, height: 0 },
    applyOps: (ops: Op[], label?: string) => batches.push({ ops, label: label ?? '' }),
    batches,
  };
}

describe('useDistribute + ActionsProvider', () => {
  it('registers two distribute Actions; unregisters on unmount', () => {
    let regSnap: ActionsRegistry | null = null;
    function Probe() { const r = useActionsRegistry(); useEffect(() => { regSnap = r; }); return null; }
    const adapter = makeAdapter();
    function Host() { useDistribute<Pose>(adapter); return null; }
    const { rerender } = render(
      <ActionsProvider>
        <Host />
        <Probe />
      </ActionsProvider>,
    );
    const ids = regSnap!.list().filter(a => a.id.startsWith('distribute.')).map(a => a.id).sort();
    expect(ids).toEqual(['distribute.horizontal', 'distribute.vertical']);
    rerender(<ActionsProvider><Probe /></ActionsProvider>);
    expect(regSnap!.list().filter(a => a.id.startsWith('distribute.'))).toHaveLength(0);
  });

  it('trigger("distribute.horizontal") distributes selection via the registry', () => {
    const adapter = makeAdapter(['a', 'b', 'c']);
    let regSnap: ActionsRegistry | null = null;
    function Probe() { const r = useActionsRegistry(); useEffect(() => { regSnap = r; }); return null; }
    function Host() { useDistribute<Pose>(adapter); return null; }
    render(<ActionsProvider><Host /><Probe /></ActionsProvider>);
    expect(regSnap!.trigger('distribute.horizontal')).toBe(true);
    expect(adapter.batches).toHaveLength(1);
    expect(adapter.batches[0].label).toBe('Distribute');
  });

  it('imperative distribute() still works inside provider', () => {
    const adapter = makeAdapter(['a', 'b', 'c']);
    let imperative: ((axis: 'x' | 'y') => void) | undefined;
    function Host() {
      const { distribute } = useDistribute<Pose>(adapter);
      imperative = distribute;
      return null;
    }
    render(<ActionsProvider><Host /></ActionsProvider>);
    imperative!('x');
    expect(adapter.batches).toHaveLength(1);
  });

  it('actions disabled when selection < 3', () => {
    const adapter = makeAdapter(['a', 'b']);
    let regSnap: ActionsRegistry | null = null;
    function Probe() { const r = useActionsRegistry(); useEffect(() => { regSnap = r; }); return null; }
    function Host() { useDistribute<Pose>(adapter); return null; }
    render(<ActionsProvider><Host /><Probe /></ActionsProvider>);
    const h = regSnap!.list().find(a => a.id === 'distribute.horizontal');
    expect(h?.enabled?.()).toBe('selection-required');
  });

  it('defaultMode option flows through to registered actions', () => {
    const adapter = makeAdapter(['a', 'b', 'c']);
    let regSnap: ActionsRegistry | null = null;
    function Probe() { const r = useActionsRegistry(); useEffect(() => { regSnap = r; }); return null; }
    function Host() { useDistribute<Pose>(adapter, { defaultMode: 'gaps' }); return null; }
    render(<ActionsProvider><Host /><Probe /></ActionsProvider>);
    expect(regSnap!.trigger('distribute.horizontal')).toBe(true);
    // 'gaps' mode: span = 110 - 0 = 110; sumSizes = 30; gap = (110-30)/2 = 40.
    // Cursor: 0 → 50 → 100. b should move from x:30 → x:50 (delta +20).
    const op = adapter.batches[0].ops[0];
    let captured: { id?: string; pose?: Pose } = {};
    op.apply({ setPose: (id: string, pose: Pose) => { captured = { id, pose }; } });
    expect(captured.id).toBe('b');
    expect(captured.pose?.x).toBe(50);
  });
});
