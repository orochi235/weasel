import { describe, it, expect } from 'vitest';
import { useEffect } from 'react';
import { render } from '@testing-library/react';
import { useAlign } from './align';
import { ActionsProvider, useActionsRegistry, type ActionsRegistry } from '../registry';
import type { Op } from '../../../core/ops/types';
import { asNodeId, type NodeId } from '../../../core/scene/types';

type Pose = { x: number; y: number; width: number; height: number };

function makeAdapter(initialIds: string[] = ['a', 'b']) {
  const batches: { ops: Op[]; label: string }[] = [];
  const poses: Record<string, Pose> = {
    a: { x: 0, y: 0, width: 10, height: 10 },
    b: { x: 50, y: 20, width: 10, height: 10 },
  };
  return {
    getSelection: () => initialIds.map(asNodeId),
    getPose: (id: NodeId): Pose => poses[id as unknown as string] ?? { x: 0, y: 0, width: 0, height: 0 },
    applyBatch: (ops: Op[], label?: string) => batches.push({ ops, label: label ?? '' }),
    batches,
  };
}

describe('useAlign + ActionsProvider', () => {
  it('registers six align Actions; unregisters on unmount', () => {
    let regSnap: ActionsRegistry | null = null;
    function Probe() { const r = useActionsRegistry(); useEffect(() => { regSnap = r; }); return null; }
    const adapter = makeAdapter();
    function Host() { useAlign<Pose>(adapter); return null; }
    const { rerender } = render(
      <ActionsProvider>
        <Host />
        <Probe />
      </ActionsProvider>,
    );
    const ids = regSnap!.list().filter(a => a.id.startsWith('align.')).map(a => a.id).sort();
    expect(ids).toEqual([
      'align.bottom',
      'align.centerX',
      'align.centerY',
      'align.left',
      'align.right',
      'align.top',
    ]);
    rerender(<ActionsProvider><Probe /></ActionsProvider>);
    expect(regSnap!.list().filter(a => a.id.startsWith('align.'))).toHaveLength(0);
  });

  it('trigger("align.left") aligns selection via the registry', () => {
    const adapter = makeAdapter(['a', 'b']);
    let regSnap: ActionsRegistry | null = null;
    function Probe() { const r = useActionsRegistry(); useEffect(() => { regSnap = r; }); return null; }
    function Host() { useAlign<Pose>(adapter); return null; }
    render(
      <ActionsProvider>
        <Host />
        <Probe />
      </ActionsProvider>,
    );
    expect(regSnap!.trigger('align.left')).toBe(true);
    expect(adapter.batches).toHaveLength(1);
    expect(adapter.batches[0].label).toBe('Align');
  });

  it('imperative align() still works inside provider', () => {
    const adapter = makeAdapter(['a', 'b']);
    let imperative: ((edge: 'left' | 'right' | 'top' | 'bottom' | 'center-x' | 'center-y') => void) | undefined;
    function Host() { const { align } = useAlign<Pose>(adapter); imperative = align; return null; }
    render(<ActionsProvider><Host /></ActionsProvider>);
    imperative!('right');
    expect(adapter.batches).toHaveLength(1);
  });

  it('actions remain disabled when selection < 2', () => {
    const adapter = makeAdapter(['a']);
    let regSnap: ActionsRegistry | null = null;
    function Probe() { const r = useActionsRegistry(); useEffect(() => { regSnap = r; }); return null; }
    function Host() { useAlign<Pose>(adapter); return null; }
    render(<ActionsProvider><Host /><Probe /></ActionsProvider>);
    const left = regSnap!.list().find(a => a.id === 'align.left');
    expect(left?.enabled?.()).toBe('selection-required');
  });
});
