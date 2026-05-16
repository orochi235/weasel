import { describe, it, expect } from 'vitest';
import { useEffect } from 'react';
import { render } from '@testing-library/react';
import { useBooleans } from './useBooleans';
import type { BooleansAdapter } from './booleans';
import type { Path } from 'features/paths/types';
import type { Op } from 'core/ops/types';
import type { NodeId } from 'core/scene/types';
import { ActionsProvider, useActionsRegistry, evaluateEnabled, type ActionsRegistry } from '../registry';

function makeAdapter(selectedIds: NodeId[] = ['a' as NodeId, 'b' as NodeId]) {
  const nodes: { id: NodeId; path: Path }[] = [
    { id: 'a' as NodeId, path: { kind: 'rect', x: 0, y: 0, width: 10, height: 10 } },
    { id: 'b' as NodeId, path: { kind: 'rect', x: 5, y: 5, width: 10, height: 10 } },
  ];
  const paths = new Map(nodes.map((n) => [n.id, n.path]));
  const idx = new Map(nodes.map((n, i) => [n.id, i]));
  const state = { batches: [] as { ops: Op[]; label: string }[] };
  let nextId = 1;
  const adapter: BooleansAdapter = {
    getSelection: () => selectedIds,
    getWorldPath: (id) => paths.get(id),
    compareZ: (a, b) => (idx.get(a) ?? 0) - (idx.get(b) ?? 0),
    createPathNode: () => ({ id: `r${nextId++}` }),
    insertNode: () => {},
    removeNode: () => {},
    setSelection: () => {},
    applyOps: (ops, label) => {
      state.batches.push({ ops, label: label ?? '' });
      for (const op of ops) op.apply(adapter);
    },
  };
  return { adapter, state };
}

describe('useBooleans + ActionsProvider', () => {
  it('registers five Pathfinder Actions; unregisters on unmount', () => {
    let regSnap: ActionsRegistry | null = null;
    function Probe() { const r = useActionsRegistry(); useEffect(() => { regSnap = r; }); return null; }
    const { adapter } = makeAdapter();
    function Host() { useBooleans(adapter); return null; }
    const { rerender } = render(
      <ActionsProvider>
        <Host />
        <Probe />
      </ActionsProvider>,
    );
    const ids = regSnap!.list().filter(a => a.id.startsWith('pathfinder.')).map(a => a.id).sort();
    expect(ids).toEqual([
      'pathfinder.divide',
      'pathfinder.exclude',
      'pathfinder.intersect',
      'pathfinder.subtract',
      'pathfinder.union',
    ]);
    rerender(<ActionsProvider><Probe /></ActionsProvider>);
    expect(regSnap!.list().filter(a => a.id.startsWith('pathfinder.'))).toHaveLength(0);
  });

  it('trigger("pathfinder.union") runs the op via the registry', () => {
    const { adapter, state } = makeAdapter();
    let regSnap: ActionsRegistry | null = null;
    function Probe() { const r = useActionsRegistry(); useEffect(() => { regSnap = r; }); return null; }
    function Host() { useBooleans(adapter); return null; }
    render(
      <ActionsProvider>
        <Host />
        <Probe />
      </ActionsProvider>,
    );
    expect(regSnap!.trigger('pathfinder.union')).toBe(true);
    expect(state.batches).toHaveLength(1);
    expect(state.batches[0].label).toBe('Union');
  });

  it('actions report disabled when selection < 2', () => {
    const { adapter } = makeAdapter(['a' as NodeId]);
    let regSnap: ActionsRegistry | null = null;
    function Probe() { const r = useActionsRegistry(); useEffect(() => { regSnap = r; }); return null; }
    function Host() { useBooleans(adapter); return null; }
    render(
      <ActionsProvider>
        <Host />
        <Probe />
      </ActionsProvider>,
    );
    const act = regSnap!.list().find(a => a.id === 'pathfinder.union')!;
    const res = evaluateEnabled(act);
    expect(res.enabled).toBe(false);
    expect(res.reason).toBe('selection-required');
  });

  it('enableActions: false skips registration; imperative still works', () => {
    const { adapter, state } = makeAdapter();
    let regSnap: ActionsRegistry | null = null;
    let imperative: { union: () => void } | undefined;
    function Probe() { const r = useActionsRegistry(); useEffect(() => { regSnap = r; }); return null; }
    function Host() { imperative = useBooleans(adapter, { enableActions: false }); return null; }
    render(
      <ActionsProvider>
        <Host />
        <Probe />
      </ActionsProvider>,
    );
    expect(regSnap!.list().filter(a => a.id.startsWith('pathfinder.'))).toHaveLength(0);
    imperative!.union();
    expect(state.batches).toHaveLength(1);
  });

  it('groups under "pathfinder" for ActionBar consumers', () => {
    let regSnap: ActionsRegistry | null = null;
    function Probe() { const r = useActionsRegistry(); useEffect(() => { regSnap = r; }); return null; }
    const { adapter } = makeAdapter();
    function Host() { useBooleans(adapter); return null; }
    render(
      <ActionsProvider>
        <Host />
        <Probe />
      </ActionsProvider>,
    );
    const groups = new Set(regSnap!.list().filter(a => a.id.startsWith('pathfinder.')).map(a => a.group));
    expect(groups).toEqual(new Set(['pathfinder']));
  });
});
