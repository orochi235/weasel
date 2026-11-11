/**
 * Stateful property test of a mode registry and what reads it: random mode switches (known and unknown ids),
 * subscribes and unsubscribes on the registry, a scoping dim, and a decoration set (the same listener on several
 * at once included), invalidations, and painter registrations and releases, against a model. Every step checks
 * the active mode, versions, which listeners heard what, tool and contribution eligibility, scoping answers,
 * the painted decorations, and that `getActiveModeFor` hands back the same object until the mode changes.
 */
import { describe, expect, it } from 'vitest';
import fc from 'fast-check';
import { IMPLICIT_TAGS } from './capabilities';
import { createModeDecorations, type ModeDecorations } from './decorations';
import { eligibleContribution, eligibleTool } from './eligibility';
import type { ModeDefinition } from './modeDefinition';
import { activeModeOf, createModeRegistry, getActiveModeFor, type ActiveMode, type ModeRegistry } from './registry';
import { createScopingDim, OUT_OF_SCOPE_ALPHA, type ScopingDim } from './scopingLayer';
import { MODE_IDS, modes, NODE_IDS, runs, TAGS, tally, timeoutFor } from './pbt.fixture';

const RUNS = 200;
const LISTENERS = 3;
type Surface = 'registry' | 'scope' | 'decorations';
const SURFACES: readonly Surface[] = ['registry', 'scope', 'decorations'];

interface Model {
  modes: readonly ModeDefinition[];
  active: string;
  /** For each surface, the listeners on it. */
  on: Record<Surface, Set<number>>;
  /** Each unsubscribe handed out: its surface, its listener, and whether it is still live. */
  offs: { surface: Surface; who: number; live: boolean }[];
  targets: Set<string>;
  /** Mode id to the registration number of its painter. */
  painters: Map<string, number>;
  registered: number;
  releases: { mode: string; n: number }[];
  /** The alpha the scope dims at, as it resolves `dimAlpha`. */
  dim: number;
}

interface Real {
  reg: ModeRegistry;
  scope: ScopingDim;
  decor: ModeDecorations;
  active: () => ActiveMode;
  heard: number[];
  fns: (() => void)[];
  offs: (() => void)[];
  releases: (() => void)[];
  targets: Set<string>;
  last: { version: number; scope: number; decor: number; active: ActiveMode };
}

const t = tally();

function setup(ms: readonly ModeDefinition[], initial: string, dimAlpha: number | undefined): { model: Model; real: Real } {
  const reg = createModeRegistry({ modes: ms, initial });
  const targets = new Set<string>();
  const scope = createScopingDim({ registry: reg, getTargetIds: () => targets, dimAlpha });
  const decor = createModeDecorations({ registry: reg });
  const heard: number[] = [];
  const fns = Array.from({ length: LISTENERS }, (_, who) => () => { heard.push(who); });
  const active = getActiveModeFor(reg);
  const real: Real = {
    reg, scope, decor, active, heard, fns, offs: [], releases: [], targets,
    last: { version: reg.getVersion(), scope: scope.getVersion(), decor: decor.getVersion(), active: active() },
  };
  const model: Model = {
    modes: ms, active: initial, on: { registry: new Set(), scope: new Set(), decorations: new Set() },
    offs: [], targets: new Set(), painters: new Map(), registered: 0, releases: [], dim: resolved(dimAlpha),
  };
  return { model, real };
}

/** Who hears a change to `surfaces`: each listener once for every one of them it is on. */
const hearers = (m: Model, surfaces: readonly Surface[]): number[] => surfaces.flatMap((s) => [...m.on[s]]).sort();

/** Run `act`, then check every listener heard what `changed` tells it, and the state both share. */
function step(m: Model, r: Real, changed: readonly Surface[], act: () => void): void {
  r.heard.length = 0;
  act();
  expect([...r.heard].sort()).toEqual(hearers(m, changed));
  if (r.heard.length > 0) t.count('heard');
  const mode = m.modes.find((x) => x.id === m.active)!;
  expect(r.reg.current()).toBe(mode);
  expect(r.reg.list().map((x) => x.id)).toEqual(m.modes.map((x) => x.id));
  expect(r.reg.reflection.entries().map((e) => e.key)).toEqual(m.modes.map((x) => x.id));
  for (const x of m.modes) expect(r.reg.byId(x.id)).toBe(x);

  const version = r.reg.getVersion();
  const scopeVersion = r.scope.getVersion();
  const decorVersion = r.decor.getVersion();
  expect(version > r.last.version).toBe(changed.includes('registry'));
  expect(scopeVersion > r.last.scope).toBe(changed.includes('scope'));
  expect(decorVersion > r.last.decor).toBe(changed.includes('decorations'));
  expect(version).toBeGreaterThanOrEqual(r.last.version);
  expect(scopeVersion).toBeGreaterThanOrEqual(r.last.scope);
  expect(decorVersion).toBeGreaterThanOrEqual(r.last.decor);

  const active = r.active();
  expect(active === r.last.active).toBe(!changed.includes('registry'));
  expect(active.id).toBe(m.active);
  expect([...active.allowedCapabilities].sort()).toEqual([...new Set([...mode.allows, ...IMPLICIT_TAGS])].sort());
  expect(activeModeOf(mode)).toEqual(active);
  r.last = { version, scope: scopeVersion, decor: decorVersion, active };
  for (const tag of TAGS) {
    const ok = active.allowedCapabilities.has(tag);
    expect(eligibleTool(r.reg, { id: 't', capabilities: [tag] })).toBe(ok);
    expect(eligibleContribution(r.reg, { id: 'c', eligibility: { capabilities: ['navigation', tag] } })).toBe(ok);
  }

  for (const id of NODE_IDS) {
    const lit = !mode.scoping || m.targets.has(id);
    expect(r.scope.alphaFor(id)).toBe(lit ? 1 : m.dim);
    expect(r.scope.isPointerInteractive(id)).toBe(lit);
  }
  const n = m.painters.get(m.active);
  expect(r.decor.paint()).toEqual(n === undefined ? [] : [n]);
}

class SetMode implements fc.Command<Model, Real> {
  id = '';
  constructor(readonly pick: number, readonly other: string | null) {}
  check = (): boolean => true;
  run(m: Model, r: Real): void {
    this.id = this.other ?? m.modes[this.pick % m.modes.length]!.id;
    const known = m.modes.some((x) => x.id === this.id);
    const moves = known && this.id !== m.active;
    t.count(!known ? 'unknown mode' : moves ? 'switch' : 'same mode');
    step(m, r, moves ? SURFACES : [], () => {
      if (known) {
        m.active = this.id;
        r.reg.setMode(this.id);
      } else expect(() => r.reg.setMode(this.id)).toThrow(/Unknown mode id/);
    });
    if (!known) expect(() => r.reg.byId(this.id)).toThrow(/Unknown mode id/);
  }
  toString = (): string => `setMode(${JSON.stringify(this.id)})`;
}

class Subscribe implements fc.Command<Model, Real> {
  constructor(readonly surface: Surface, readonly who: number) {}
  check = (): boolean => true;
  run(m: Model, r: Real): void {
    step(m, r, [], () => {
      const held = m.on[this.surface].has(this.who);
      m.on[this.surface].add(this.who);
      m.offs.push({ surface: this.surface, who: this.who, live: !held });
      if (held) for (const o of m.offs) if (o.surface === this.surface && o.who === this.who) o.live = true;
      const target = this.surface === 'registry' ? r.reg : this.surface === 'scope' ? r.scope : r.decor;
      r.offs.push(target.subscribe(r.fns[this.who]!));
    });
  }
  toString = (): string => `subscribe(${this.surface}, ${this.who})`;
}

class Unsubscribe implements fc.Command<Model, Real> {
  constructor(readonly at: number) {}
  check = (m: Readonly<Model>): boolean => m.offs.length > 0;
  run(m: Model, r: Real): void {
    const i = this.at % m.offs.length;
    const o = m.offs[i]!;
    step(m, r, [], () => {
      if (o.live) {
        m.on[o.surface].delete(o.who);
        for (const x of m.offs) if (x.surface === o.surface && x.who === o.who) x.live = false;
        if (SURFACES.some((s) => s !== o.surface && m.on[s].has(o.who))) t.count('shared listener off');
      }
      r.offs[i]!();
    });
  }
  toString = (): string => `unsubscribe(#${this.at})`;
}

class Target implements fc.Command<Model, Real> {
  constructor(readonly ids: readonly string[], readonly invalidate: boolean) {}
  check = (): boolean => true;
  run(m: Model, r: Real): void {
    step(m, r, this.invalidate ? ['scope'] : [], () => {
      m.targets = new Set(this.ids);
      r.targets.clear();
      for (const id of this.ids) r.targets.add(id);
      if (this.invalidate) r.scope.invalidate();
    });
    t.count('target');
  }
  toString = (): string => `target(${JSON.stringify(this.ids)}${this.invalidate ? ', invalidate' : ''})`;
}

class Paint implements fc.Command<Model, Real> {
  mode = '';
  constructor(readonly pick: number, readonly other: string | null) {}
  check = (): boolean => true;
  run(m: Model, r: Real): void {
    this.mode = this.other ?? m.modes[this.pick % m.modes.length]!.id;
    step(m, r, ['decorations'], () => {
      const n = ++m.registered;
      m.painters.set(this.mode, n);
      m.releases.push({ mode: this.mode, n });
      r.releases.push(r.decor.register(this.mode, () => [n]));
    });
  }
  toString = (): string => `register(${JSON.stringify(this.mode)})`;
}

class Release implements fc.Command<Model, Real> {
  constructor(readonly at: number) {}
  check = (m: Readonly<Model>): boolean => m.releases.length > 0;
  run(m: Model, r: Real): void {
    const i = this.at % m.releases.length;
    const { mode, n } = m.releases[i]!;
    const live = m.painters.get(mode) === n;
    t.count(live ? 'release' : 'stale release');
    step(m, r, live ? ['decorations'] : [], () => {
      if (live) m.painters.delete(mode);
      r.releases[i]!();
    });
  }
  toString = (): string => `release(#${this.at})`;
}

const modeId = fc.constantFrom(...MODE_IDS, 'missing', 'toString');
const dimAlpha = fc.option(fc.oneof(fc.double({ min: -1, max: 2, noNaN: true }), fc.constantFrom(NaN, Infinity, -Infinity)), { nil: undefined });
const resolved = (a: number | undefined) => (a === undefined || Number.isNaN(a) ? OUT_OF_SCOPE_ALPHA : Math.min(1, Math.max(0, a)));

const commands = [
  fc.tuple(fc.nat(), fc.option(modeId, { freq: 5 })).map(([i, id]) => new SetMode(i, id)),
  fc.tuple(fc.nat(), fc.option(modeId, { freq: 5 })).map(([i, id]) => new SetMode(i, id)),
  fc.tuple(fc.constantFrom(...SURFACES), fc.integer({ min: 0, max: LISTENERS - 1 })).map(([s, w]) => new Subscribe(s, w)),
  fc.nat(30).map((i) => new Unsubscribe(i)),
  fc.tuple(fc.subarray([...NODE_IDS]), fc.boolean()).map(([ids, inv]) => new Target(ids, inv)),
  fc.tuple(fc.nat(), fc.option(modeId, { freq: 5 })).map(([i, id]) => new Paint(i, id)),
  fc.nat(30).map((i) => new Release(i)),
];

describe('mode registry, against a model', () => {
  it('switches modes, notifies, versions, gates, scopes, and paints as the model says', () => {
    fc.assert(fc.property(modes, fc.nat(), dimAlpha, fc.commands(commands, { size: '+1', maxCommands: 40 }), (ms, pick, alpha, cmds) => {
      fc.modelRun(() => setup(ms, ms[pick % ms.length]!.id, alpha), cmds);
    }), runs(RUNS));
    t.atLeast('switch', RUNS / 2);
    t.atLeast('same mode', RUNS / 4);
    t.atLeast('unknown mode', RUNS / 4);
    t.atLeast('heard', RUNS / 2);
    t.atLeast('shared listener off', RUNS / 10);
    t.atLeast('release', RUNS / 4);
    t.atLeast('stale release', RUNS / 10);
  }, timeoutFor(RUNS, 10));
});
