import { describe, expect, it } from 'vitest';
import { assembleEntries, scopeBindings } from './assemble';
import type { Contribution } from './types';

const tool = (id: string, extra: Partial<Contribution['eligibility']> = {}): Contribution => ({
  id,
  eligibility: { focus: true, ...extra },
  bindings: [{ spec: { kind: 'drag' }, actionId: `${id}.drag` }],
});

describe('assembleEntries', () => {
  const entries = [tool('select'), tool('hand'), tool('zoom')];

  it('leads with held entries, newest hold first, then the rest in declaration order', () => {
    const { ordered } = assembleEntries(entries, { focusedId: 'select', hotkeyStack: ['hand', 'zoom'] });
    expect(ordered.map((e) => e.id)).toEqual(['zoom', 'hand', 'select']);
  });

  it('tiers what it orders: held entries hotkey, the focused one active', () => {
    const { ordered, state } = assembleEntries(entries, { focusedId: 'select', hotkeyStack: ['hand'] });
    expect(scopeBindings(ordered, state).map((b) => [b.ownerId, b.scope]))
      .toEqual([['hand', 'hotkey'], ['select', 'active']]);
  });

  it('bars an entry whose capabilities the mode does not all allow', () => {
    const pen = tool('pen', { capabilities: ['creates-shapes'] });
    const live = (allowed: string[]) => {
      const { ordered, state } = assembleEntries([pen], {
        focusedId: 'pen', hotkeyStack: [], allowedCapabilities: new Set(allowed),
      });
      return scopeBindings(ordered, state).length;
    };
    expect(live(['creates-shapes'])).toBe(1);
    expect(live(['navigation'])).toBe(0);
  });
});
