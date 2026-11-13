/**
 * Property tests of binding overrides: merging maps against a model, what an unbind and a rebind do to the
 * bindings around them, applying overrides to an action twice, and an override persisted as its route string
 * (`keySpecRoute`) matching every keystroke the spec it was written from matches.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import fc from 'fast-check';
import { keySpecRoute, matchSpec, type GestureSpec, type KeySpec, type PhaseSpec } from '@weasel-js/gestures';
import { keyEvents, modSpec, runs, tally, timeoutFor } from '../../pbt.fixture';
import { actionBindings, type GestureBinding } from './binding';
import { ActionsNode } from './ActionsProvider';
import type { Action } from './action';
import {
  bindingId, overriddenBindings, overrideActionBindings, resolveBindingOverrides, type BindingOverrides,
} from './bindingOverrides';

const KEYS = ['a', 'B', '1', 'Enter', 'ArrowUp', ' ', 'F2', '+', '?', '[', 'é'];
const PHASES: (PhaseSpec | undefined)[] = [
  undefined, 'initial', 'engaged', '*',
  [{ channel: '*', phase: 'initial' }], [{ channel: '&', phase: 'engaged' }, { channel: '*', phase: 'initial' }],
  [{ channel: 'tool', phase: 'engaged' }],
];

const keySpec: fc.Arbitrary<KeySpec> = fc.record({
  key: fc.oneof({ weight: 5, arbitrary: fc.constantFrom<string | string[]>(...KEYS) }, { weight: 1, arbitrary: fc.constant(['a', 'Enter']) }),
  mods: modSpec, phase: fc.constantFrom(...PHASES),
}).map(({ key, mods, phase }) => ({
  kind: 'key', key, ...(mods !== undefined ? { mods } : {}), ...(phase !== undefined ? { phase } : {}),
}) as KeySpec);

const binding: fc.Arbitrary<GestureBinding> = fc.record({
  spec: keySpec, actionId: fc.constantFrom('x', 'y'), id: fc.option(fc.constantFrom('p', 'q', 'r'), { nil: undefined }),
}).map(({ spec, actionId, id }) => ({ spec, actionId, ...(id !== undefined ? { opts: { id } } : {}) }));

const ID_POOL = ['p', 'q', 'r', 'o#0', 'o#1', 'o#2', 'o#3', 'x@0', 'x@1', 'x@2'];

let warn: ReturnType<typeof vi.spyOn>;
beforeEach(() => { warn = vi.spyOn(console, 'warn').mockImplementation(() => {}); });
afterEach(() => { warn.mockRestore(); });

describe('resolveBindingOverrides', () => {
  const input = fc.oneof(
    fc.constant(null),
    keySpec,
    keySpec.map((s) => keySpecRoute(s)).filter((r): r is string => r !== null),
    fc.constantFrom('', 'nonsense(', '[x] keyDown('),
  );
  const map: fc.Arbitrary<BindingOverrides> = fc.dictionary(fc.constantFrom(...ID_POOL), input, { maxKeys: 4 });

  it('lets a later map win per id, and a route that does not parse leave the earlier value', () => {
    const t = tally();
    fc.assert(fc.property(fc.array(map, { maxLength: 4 }), (maps) => {
      const got = resolveBindingOverrides(maps);
      const want = new Map<string, unknown>();
      for (const m of maps) {
        for (const [id, v] of Object.entries(m)) {
          if (typeof v === 'string' && (v === '' || v.endsWith('('))) { t.hit('skipped'); continue; }
          want.set(id, v);
        }
      }
      expect([...got.keys()].sort()).toEqual([...want.keys()].sort());
      for (const [id, v] of want) {
        if (typeof v === 'string') { t.hit('route'); expect(got.get(id)?.kind).toBe('key'); }
        else expect(got.get(id)).toEqual(v);
      }
    }), runs(300));
    t.expectHit('skipped', 'route');
  }, timeoutFor(300, 2));
});

describe('overriddenBindings', () => {
  const owned = fc.record({ owner: fc.constantFrom<string | null>('o', null), bindings: fc.array(binding, { maxLength: 4 }) });

  it('leaves the bindings alone under no override, drops exactly the unbound ones, and rebinds in place', () => {
    const t = tally();
    fc.assert(fc.property(owned, fc.dictionary(fc.constantFrom(...ID_POOL), fc.option(keySpec, { nil: null }), { maxKeys: 4 }), ({ owner, bindings }, raw) => {
      expect(overriddenBindings(bindings, owner)).toEqual(bindings);
      const overrides = new Map(Object.entries(raw) as [string, GestureSpec | null][]);
      const got = overriddenBindings(bindings, owner, overrides);
      const kept = bindings.map((b, i) => ({ b, id: bindingId(b, owner, i) })).filter(({ id }) => overrides.get(id) !== null);
      expect(got.length).toBe(kept.length);
      got.forEach((g, i) => {
        const { b, id } = kept[i]!;
        expect(g.actionId).toBe(b.actionId);
        expect(g.opts).toEqual(b.opts);
        expect(g.spec).toEqual(overrides.has(id) ? overrides.get(id) : b.spec);
        if (overrides.has(id)) t.hit('rebound');
      });
      if (kept.length < bindings.length) t.hit('unbound');
    }), runs(300));
    t.expectHit('rebound', 'unbound');
  }, timeoutFor(300, 2));
});

describe('overrideActionBindings', () => {
  const action = fc.array(keySpec, { maxLength: 4 }).map((specs): Action => ({ id: 'x', label: 'X', defaultBinding: specs }) as Action);
  const overrides = fc.dictionary(fc.constantFrom('x@0', 'x@1', 'x@2', 'x@3'), fc.option(keySpec, { nil: null }), { maxKeys: 3 })
    .map((raw) => new Map(Object.entries(raw) as [string, GestureSpec | null][]));

  it('binds what overriddenBindings routes, keeps each binding its id, and applied again changes nothing', () => {
    const t = tally();
    fc.assert(fc.property(action, overrides, (a, o) => {
      const once = overrideActionBindings(a, o);
      const routed = overriddenBindings(actionBindings(a), null, o);
      expect(actionBindings(once).map((b) => b.spec)).toEqual(routed.map((b) => b.spec));
      const ids = actionBindings(a).map((b, i) => bindingId(b, null, i)).filter((id) => o.get(id) !== null);
      if (once !== a) {
        t.hit('changed');
        expect(actionBindings(once).map((b, i) => bindingId(b, null, i))).toEqual(ids);
      }
      expect(actionBindings(overrideActionBindings(once, o))).toEqual(actionBindings(once));
    }), runs(300));
    t.expectHit('changed');
  }, timeoutFor(300, 2));
});

describe('an override persisted as a route', () => {
  const engaged = [new Set<string>(), new Set(['own']), new Set(['tool']), new Set(['own', 'tool'])];

  it('matches every keystroke, on both platforms and in every phase, that the spec it was written from matches', () => {
    const t = tally();
    fc.assert(fc.property(keySpec, (spec) => {
      const route = keySpecRoute(spec);
      if (route === null) { t.hit('unroutable'); return; }
      t.hit('routed');
      const back = resolveBindingOverrides([{ only: route }]).get('only');
      expect(back).toBeDefined();
      for (const apple of [true, false]) {
        for (const engagedChannels of engaged) {
          const ctx = { selfChannel: 'own', engagedChannels };
          for (const key of KEYS) {
            for (const e of keyEvents(key)) {
              const ev = { kind: 'key' as const, ...e };
              expect(matchSpec(ev, back!, apple, ctx), `${route} on ${JSON.stringify(ev)}`).toBe(matchSpec(ev, spec, apple, ctx));
            }
          }
        }
      }
    }), runs(200));
    t.expectHit('routed', 'unroutable');
  }, timeoutFor(200, 20));
});

describe('an override on a registered action', () => {
  // Declared bindings, some with an id; tunings adding keys beside them, some with an id.
  const declared = fc.array(fc.record({ key: fc.constantFrom('a', 'b', 'c'), id: fc.option(fc.constantFrom('x.one', 'x.two'), { nil: undefined }) }), { minLength: 1, maxLength: 3 });
  const tunings = fc.array(fc.record({ key: fc.constantFrom('t', 'u'), id: fc.option(fc.constant('x.tuned'), { nil: undefined }), live: fc.boolean() }), { maxLength: 3 });
  const named = fc.dictionary(fc.constantFrom('x@0', 'x@1', 'x@2', 'x@3', 'x@4', 'x.one', 'x.two', 'x.tuned'), fc.option(fc.constantFrom('p', 'q'), { nil: null }), { maxKeys: 3 });
  const bound = (k: string, id: string | undefined) => ({ spec: { kind: 'key' as const, key: k }, ...(id ? { opts: { id } } : {}) });

  it('replaces the declared binding it names, or a tuned one by its declared id, whichever tunings are live', () => {
    const t = tally();
    fc.assert(fc.property(declared, tunings, named, (own, tuned, raw) => {
      const { registry } = new ActionsNode(null, true, () => null);
      registry.register({ id: 'x', label: 'X', defaultBinding: own.map((b) => bound(b.key, b.id)), invoker: { timing: 'immediate', run: () => {} } });
      for (const tn of tuned) if (tn.live) registry.tune('x', { bindings: [bound(tn.key, tn.id)] });
      registry.overrideBindings(Object.fromEntries(Object.entries(raw).map(([id, k]) => [id, k === null ? null : { kind: 'key', key: k }])));
      const keyOf = (id: string, fallback: string): string | null => (id in raw ? raw[id] ?? null : fallback);
      const want = [
        ...own.map((b, i) => keyOf(b.id ?? `x@${i}`, b.key)),
        ...tuned.filter((tn) => tn.live).map((tn) => (tn.id ? keyOf(tn.id, tn.key) : tn.key)),
      ].filter((k): k is string => k !== null);
      const got = actionBindings(registry.list()[0]!).map((b) => (b.spec as KeySpec).key);
      expect(got).toEqual(want);
      if (tuned.some((tn) => tn.live && !tn.id) && Object.keys(raw).some((id) => id.startsWith('x@') && Number(id.slice(2)) >= own.length)) {
        t.hit('positional id past the declared ones');
      }
    }), runs(300));
    t.expectHit('positional id past the declared ones');
  }, timeoutFor(300, 3));
});
