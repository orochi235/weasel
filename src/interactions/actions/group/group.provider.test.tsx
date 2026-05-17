import { describe, it, expect } from 'vitest';
import { useEffect } from 'react';
import { render } from '@testing-library/react';
import { useGroup, useUngroup } from './group';
import type { GroupActionAdapter } from './group';
import { ActionsProvider, useActionsRegistry, type ActionsRegistry } from '../registry';
import type { Op } from 'core/ops/types';
import { asNodeId } from 'core/scene/types';
import type { Group } from 'features/groups/types';

function makeAdapter(initialGroups: Group[] = []) {
  const groups = new Map(initialGroups.map((g) => [g.id, g]));
  let selection = [asNodeId('a'), asNodeId('b')];
  const batches: { ops: Op[]; label: string }[] = [];
  const adapter: GroupActionAdapter = {
    getSelection: () => selection,
    getGroup: (id) => groups.get(id),
    getGroupsForMember: () => [],
    insertGroup: (g) => { groups.set(g.id, g); },
    removeGroup: (id) => { groups.delete(id); },
    addToGroup: () => {},
    removeFromGroup: () => {},
    applyOps: (ops, label) => { batches.push({ ops, label }); },
  };
  return {
    adapter,
    batches,
    setSel: (ids: string[]) => { selection = ids.map(asNodeId); },
    addGroup: (g: Group) => { groups.set(g.id, g); },
  };
}

describe('useGroup / useUngroup back-compat with ActionsProvider', () => {
  it('useGroup registers `group` action; unregisters on unmount', () => {
    let regSnap: ActionsRegistry | null = null;
    function Probe() { const r = useActionsRegistry(); useEffect(() => { regSnap = r; }); return null; }
    const { adapter } = makeAdapter();
    function Host() { useGroup(adapter); return null; }
    const { unmount, rerender } = render(
      <ActionsProvider><Host /><Probe /></ActionsProvider>,
    );
    expect(regSnap!.list().some((a) => a.id === 'group')).toBe(true);
    rerender(<ActionsProvider><Probe /></ActionsProvider>);
    expect(regSnap!.list().some((a) => a.id === 'group')).toBe(false);
    unmount();
  });

  it('useUngroup registers `ungroup` action (Phase 14e Task 7: keystrokes via kit-standard descriptor in dispatcher)', () => {
    let regSnap: ActionsRegistry | null = null;
    function Probe() { const r = useActionsRegistry(); useEffect(() => { regSnap = r; }); return null; }
    const { adapter } = makeAdapter();
    function Host() { useUngroup(adapter); return null; }
    render(<ActionsProvider><Host /><Probe /></ActionsProvider>);
    const a = regSnap!.list().find((x) => x.id === 'ungroup')!;
    expect(a).toBeDefined();
  });

  it('registry.trigger fires the registered group inside a provider', () => {
    const helpers = makeAdapter();
    let regSnap: ActionsRegistry | null = null;
    function Probe() { const r = useActionsRegistry(); useEffect(() => { regSnap = r; }); return null; }
    function Host() { useGroup(helpers.adapter); return null; }
    render(<ActionsProvider><Host /><Probe /></ActionsProvider>);
    regSnap!.trigger('group');
    expect(helpers.batches).toHaveLength(1);
  });

  it('falls back to direct Mod+G listener when no provider is in scope', () => {
    const helpers = makeAdapter();
    function Host() { useGroup(helpers.adapter); return null; }
    render(<Host />);
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'g', metaKey: true, bubbles: true, cancelable: true }));
    expect(helpers.batches).toHaveLength(1);
    expect(helpers.batches[0].label).toBe('Group');
  });

  it('imperative group() / ungroup() still work inside a provider', () => {
    const helpers = makeAdapter([{ id: 'g1', members: [asNodeId('a')] }]);
    helpers.setSel(['g1']);
    let groupImp: (() => string | null) | undefined;
    let ungroupImp: (() => string[]) | undefined;
    function Host() {
      const { group } = useGroup(helpers.adapter);
      const { ungroup } = useUngroup(helpers.adapter);
      groupImp = group;
      ungroupImp = ungroup;
      return null;
    }
    render(<ActionsProvider><Host /></ActionsProvider>);
    expect(ungroupImp!()).toEqual(['g1']);
    expect(helpers.batches).toHaveLength(1);
    expect(helpers.batches[0].label).toBe('Ungroup');
    void groupImp;
  });

  it('enableKeyboard: false on either hook skips registration', () => {
    let regSnap: ActionsRegistry | null = null;
    function Probe() { const r = useActionsRegistry(); useEffect(() => { regSnap = r; }); return null; }
    const { adapter } = makeAdapter();
    function Host() {
      useGroup(adapter, { enableKeyboard: false });
      useUngroup(adapter, { enableKeyboard: false });
      return null;
    }
    render(<ActionsProvider><Host /><Probe /></ActionsProvider>);
    expect(regSnap!.list().some((a) => a.id === 'group')).toBe(false);
    expect(regSnap!.list().some((a) => a.id === 'ungroup')).toBe(false);
  });
});
