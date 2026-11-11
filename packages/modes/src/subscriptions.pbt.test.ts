/**
 * Property tests of a mode registry's construction and of the subscriptions its readers keep on it. Construction:
 * any list of modes, ids repeated and named like `Object.prototype` members included, builds exactly when the ids
 * are distinct and `initial` names one, and the registry then lists, reflects, and finds each, whatever the caller
 * does to the list it gave. Subscriptions: long
 * runs of subscribes and unsubscribes (fresh, repeated, and stale) on a scoping dim and a decoration set, with
 * listeners that, while being notified, unsubscribe themselves or another, subscribe another, switch the mode
 * again, or invalidate. After every step each reader holds exactly one subscription on the registry while it has
 * a listener and none otherwise, and the next mode switch reaches each listener it holds exactly once.
 */
import { describe, expect, it } from 'vitest';
import fc from 'fast-check';
import { createModeDecorations, type ModeDecorations } from './decorations';
import type { ModeDefinition } from './modeDefinition';
import { createModeRegistry, type ModeRegistry } from './registry';
import { createScopingDim, type ScopingDim } from './scopingLayer';
import { MODE_IDS, runs, tally, timeoutFor } from './pbt.fixture';

const RUNS = 200;
const LISTENERS = 4;
const t = tally();

const mode = (id: string): ModeDefinition => ({ id, kind: 'soft', allows: [], scoping: id === 'path-edit' });
const ids = fc.constantFrom(...MODE_IDS, 'toString', 'hasOwnProperty');

describe('createModeRegistry, construction', () => {
  it('builds exactly when ids are distinct and initial names one, then lists, reflects, and finds each', () => {
    fc.assert(fc.property(fc.array(ids, { maxLength: 5 }), ids, (list, initial) => {
      const ms = list.map(mode);
      const distinct = new Set(list).size === list.length;
      const known = list.includes(initial);
      if (!distinct || !known) {
        expect(() => createModeRegistry({ modes: ms, initial })).toThrow(distinct ? /not in modes list/ : /duplicate mode id/);
        t.count(distinct ? 'unknown initial' : 'duplicate');
        return;
      }
      const reg = createModeRegistry({ modes: ms, initial });
      expect(reg.current()).toBe(ms[list.indexOf(initial)]);
      expect(reg.list()).toEqual(ms);
      expect(reg.reflection.entries().map((e) => e.value)).toEqual(ms);
      for (const m of ms) expect(reg.byId(m.id)).toBe(m);
      // The list given is the caller's: changing it afterward changes nothing registered.
      const registered = [...ms];
      ms.reverse().push(mode('later'));
      expect(reg.list()).toEqual(registered);
      expect(() => reg.byId('later')).toThrow(/Unknown mode id/);
      for (const id of [...MODE_IDS, 'toString', 'hasOwnProperty', 'valueOf']) {
        if (!list.includes(id)) {
          expect(() => reg.byId(id)).toThrow(/Unknown mode id/);
          expect(reg.reflection.has(id)).toBe(false);
        }
      }
      t.count('built');
    }), runs(RUNS));
    for (const what of ['unknown initial', 'duplicate', 'built']) t.atLeast(what, RUNS / 10);
  }, timeoutFor(RUNS, 1));
});

type Surface = 'scope' | 'decor';
/** What a listener does when notified. */
type Act =
  | { kind: 'none' }
  | { kind: 'offSelf' }
  | { kind: 'off'; handle: number }
  | { kind: 'sub'; surface: Surface; who: number }
  | { kind: 'switch'; pick: number }
  | { kind: 'invalidate' };

type Op =
  | { kind: 'sub'; surface: Surface; who: number }
  | { kind: 'off'; handle: number }
  | { kind: 'switch'; pick: number; acts: readonly Act[] }
  | { kind: 'invalidate'; acts: readonly Act[] };

interface World {
  reg: ModeRegistry;
  /** Subscriptions each reader holds on the registry now. */
  held: Record<Surface, number>;
  scope: ScopingDim;
  decor: ModeDecorations;
  /** Each unsubscribe handed out, and the self-unsubscribes of each listener on each surface. */
  offs: (() => void)[];
  latest: Map<string, () => void>;
  fns: Record<Surface, (() => void)[]>;
  /** Listeners on each surface, as the readers' emitters hold them: by subscription token. */
  on: Record<Surface, Map<number, object>>;
  heard: string[];
  acts: readonly Act[];
  depth: number;
}

/** A registry whose `subscribe` counts what each reader holds, told apart by the order they first subscribe. */
function world(): World {
  const base = createModeRegistry({ modes: MODE_IDS.map(mode), initial: MODE_IDS[0] });
  const held: Record<Surface, number> = { scope: 0, decor: 0 };
  let reader: Surface = 'scope';
  const reg: ModeRegistry = {
    ...base,
    subscribe(l) {
      const who = reader;
      held[who]++;
      const off = base.subscribe(l);
      let gone = false;
      return () => { if (!gone) { gone = true; held[who]--; } off(); };
    },
  };
  const w = { reg, held } as World;
  w.scope = createScopingDim({ registry: { ...reg, subscribe: (l) => { reader = 'scope'; return reg.subscribe(l); } }, getTargetIds: () => new Set() });
  w.decor = createModeDecorations({ registry: { ...reg, subscribe: (l) => { reader = 'decor'; return reg.subscribe(l); } } });
  w.offs = [];
  w.latest = new Map();
  w.on = { scope: new Map(), decor: new Map() };
  w.heard = [];
  w.acts = [];
  w.depth = 0;
  w.fns = { scope: [], decor: [] };
  for (const surface of ['scope', 'decor'] as const) {
    for (let who = 0; who < LISTENERS; who++) {
      w.fns[surface].push(() => {
        w.heard.push(`${surface}:${who}`);
        if (w.depth > 0) return;
        w.depth++;
        act(w, w.acts[who] ?? { kind: 'none' }, surface, who);
        w.depth--;
      });
    }
  }
  return w;
}

function subscribe(w: World, surface: Surface, who: number): void {
  const target = surface === 'scope' ? w.scope : w.decor;
  const on = w.on[surface];
  if (!on.has(who)) on.set(who, {});
  const token = on.get(who)!;
  const off = target.subscribe(w.fns[surface][who]!);
  const tracked = () => { if (on.get(who) === token) on.delete(who); off(); };
  w.offs.push(tracked);
  w.latest.set(`${surface}:${who}`, tracked);
}

function act(w: World, a: Act, surface: Surface, who: number): void {
  if (a.kind === 'offSelf') w.latest.get(`${surface}:${who}`)?.();
  else if (a.kind === 'off' && w.offs.length > 0) w.offs[a.handle % w.offs.length]!();
  else if (a.kind === 'sub') subscribe(w, a.surface, a.who);
  else if (a.kind === 'switch') w.reg.setMode(MODE_IDS[a.pick % MODE_IDS.length]!);
  else if (a.kind === 'invalidate') w.scope.invalidate();
  if (a.kind !== 'none') t.count(`mid-notify ${a.kind}`);
}

const surface = fc.constantFrom<Surface>('scope', 'decor');
const who = fc.nat(LISTENERS - 1);
const actArb: fc.Arbitrary<Act> = fc.oneof(
  { weight: 3, arbitrary: fc.constant({ kind: 'none' as const }) },
  { weight: 2, arbitrary: fc.constant({ kind: 'offSelf' as const }) },
  { weight: 2, arbitrary: fc.record({ kind: fc.constant('off' as const), handle: fc.nat(30) }) },
  { weight: 2, arbitrary: fc.record({ kind: fc.constant('sub' as const), surface, who }) },
  { weight: 1, arbitrary: fc.record({ kind: fc.constant('switch' as const), pick: fc.nat(10) }) },
  { weight: 1, arbitrary: fc.constant({ kind: 'invalidate' as const }) },
);
const acts = fc.array(actArb, { minLength: LISTENERS, maxLength: LISTENERS });
const op: fc.Arbitrary<Op> = fc.oneof(
  { weight: 4, arbitrary: fc.record({ kind: fc.constant('sub' as const), surface, who }) },
  { weight: 3, arbitrary: fc.record({ kind: fc.constant('off' as const), handle: fc.nat(30) }) },
  { weight: 3, arbitrary: fc.record({ kind: fc.constant('switch' as const), pick: fc.nat(10), acts }) },
  { weight: 1, arbitrary: fc.record({ kind: fc.constant('invalidate' as const), acts }) },
);

/** Switch to a mode other than the active one with every listener idle: each one held hears it exactly once. */
function probe(w: World): void {
  w.acts = [];
  w.heard.length = 0;
  const next = MODE_IDS.find((id) => id !== w.reg.current().id)!;
  w.reg.setMode(next);
  const want = (['scope', 'decor'] as const).flatMap((s) => [...w.on[s].keys()].map((x) => `${s}:${x}`));
  expect([...w.heard].sort()).toEqual(want.sort());
}

describe('mode readers, subscriptions under reentrant listeners', () => {
  it('hold one registry subscription while listened to, none otherwise, and reach each listener once', () => {
    fc.assert(fc.property(fc.array(op, { minLength: 1, maxLength: 60 }), (ops) => {
      const w = world();
      for (const o of ops) {
        if (o.kind === 'sub') subscribe(w, o.surface, o.who);
        else if (o.kind === 'off') { if (w.offs.length > 0) w.offs[o.handle % w.offs.length]!(); }
        else {
          w.acts = o.acts;
          if (o.kind === 'switch') w.reg.setMode(MODE_IDS[o.pick % MODE_IDS.length]!);
          else w.scope.invalidate();
        }
        for (const s of ['scope', 'decor'] as const) expect(w.held[s]).toBe(w.on[s].size > 0 ? 1 : 0);
        probe(w);
        t.count(w.on.scope.size > 0 && w.on.decor.size > 0 ? 'both listened' : 'one or none');
      }
    }), runs(RUNS));
    for (const what of ['mid-notify offSelf', 'mid-notify off', 'mid-notify sub', 'mid-notify switch', 'mid-notify invalidate', 'both listened']) {
      t.atLeast(what, RUNS / 20);
    }
  }, timeoutFor(RUNS, 10));
});
