/**
 * Every binding the kit ships declares an `opts.id`, and no two different
 * bindings share one: a binding override names a binding by that id, and a
 * derived `<owner>#<n>` moves whenever the defaults are reordered.
 *
 * The sweep reads every action, preset and contribution the packages export
 * as a value, and builds the tools and contributions that only a hook or a
 * factory makes. A binding several owners carry, one builder called twice,
 * keeps one id: one override moves it everywhere.
 */
import { describe, it, expect } from 'vitest';
import type { GestureBinding } from '@weasel-js/routing';
import { sweepKit } from './kitSweep.fixture';

/** A binding's identity apart from its id and the params its builder was configured with. */
function signature(b: GestureBinding): string {
  return JSON.stringify({ actionId: b.actionId, spec: b.spec },
    (_k, v: unknown) => (typeof v === 'function' ? `fn:${v.toString()}` : v));
}

describe('kit binding ids', () => {
  const sweep = sweepKit();

  it('reaches the kit', () => {
    expect(sweep.found.length).toBeGreaterThan(100);
  });

  it('gives every kit binding a declared id', () => {
    expect(sweep.found.filter((f) => f.id === undefined).map((f) => f.where)).toEqual([]);
  });

  it('gives no two different bindings one id', () => {
    const byId = new Map<string, Map<string, string>>();
    for (const f of sweep.found) {
      if (f.id === undefined) continue;
      const sigs = byId.get(f.id) ?? new Map<string, string>();
      sigs.set(signature(f.binding), f.where);
      byId.set(f.id, sigs);
    }
    const shared = [...byId].filter(([, sigs]) => sigs.size > 1).map(([id, sigs]) => `${id}: ${[...sigs.values()].join(' | ')}`);
    expect(shared).toEqual([]);
  });
});
