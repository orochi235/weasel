import { describe, it, expect, vi } from 'vitest';
import { useEffect } from 'react';
import { render } from '@testing-library/react';
import { useNudge } from './nudge';
import { ActionsProvider, useActionsRegistry, type ActionsRegistry } from '../registry';
import type { Op } from '../../../core/ops/types';

type Pose = { x: number; y: number; width: number; height: number };

function makeAdapter() {
  const batches: { ops: Op[]; label: string }[] = [];
  return {
    getSelection: () => ['a'],
    getPose: (_id: string): Pose => ({ x: 0, y: 0, width: 1, height: 1 }),
    applyBatch: (ops: Op[], label?: string) => batches.push({ ops, label: label ?? '' }),
    batches,
  };
}

describe('useNudge back-compat with ActionsProvider', () => {
  it('registers 8 directional Actions when wrapped in ActionsProvider; unregisters on unmount', () => {
    let regSnap: ActionsRegistry | null = null;
    function Probe() { const r = useActionsRegistry(); useEffect(() => { regSnap = r; }); return null; }
    const adapter = makeAdapter();
    function Host() { useNudge<Pose>(adapter); return null; }
    const { unmount, rerender } = render(
      <ActionsProvider>
        <Host />
        <Probe />
      </ActionsProvider>,
    );
    const ids = regSnap!.list().filter(a => a.id.startsWith('nudge.')).map(a => a.id);
    expect(ids).toHaveLength(8);
    rerender(<ActionsProvider><Probe /></ActionsProvider>);
    expect(regSnap!.list().filter(a => a.id.startsWith('nudge.'))).toHaveLength(0);
    unmount();
  });

  it('falls back to direct keydown listener when no provider is in scope', () => {
    const adapter = makeAdapter();
    function Host() { useNudge<Pose>(adapter); return null; }
    render(<Host />);
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }));
    expect(adapter.batches).toHaveLength(1);
  });

  it('inside a provider, the 8 actions have the documented ids', () => {
    let regSnap: ActionsRegistry | null = null;
    function Probe() { const r = useActionsRegistry(); useEffect(() => { regSnap = r; }); return null; }
    const adapter = makeAdapter();
    function Host() { useNudge<Pose>(adapter); return null; }
    render(<ActionsProvider><Host /><Probe /></ActionsProvider>);
    const ids = regSnap!.list().filter(a => a.id.startsWith('nudge.')).map(a => a.id).sort();
    expect(ids).toEqual([
      'nudge.down', 'nudge.down.big',
      'nudge.left', 'nudge.left.big',
      'nudge.right', 'nudge.right.big',
      'nudge.up', 'nudge.up.big',
    ]);
  });

  it('imperative nudge() return still works inside a provider', () => {
    const adapter = makeAdapter();
    let imperative: ((d: 'up' | 'down' | 'left' | 'right', large?: boolean) => void) | undefined;
    function Host() { const { nudge } = useNudge<Pose>(adapter); imperative = nudge; return null; }
    render(<ActionsProvider><Host /></ActionsProvider>);
    imperative!('right');
    expect(adapter.batches).toHaveLength(1);
  });
});
