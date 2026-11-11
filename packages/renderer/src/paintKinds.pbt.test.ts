/**
 * Stateful property test of the paint draw-kind registry: registrations, overrides, disposals in any order (twice
 * included), and loaders, against a model holding each id's stack of entries. A lookup answers the latest entry still
 * registered under its id.
 */
import { afterEach, describe, expect, it } from 'vitest';
import fc from 'fast-check';
import {
  _resetPaintDrawKindsForTests, getPaintDrawKind, isPaintKindKnown, registerPaintDrawKind, registerPaintDrawKindLoader,
  type PaintDrawKind,
} from './paintKinds';
import { runs, tally } from './pbt.fixture';

const IDS = ['pbt-a', 'pbt-b', 'pbt-c'] as const;

interface Model {
  stacks: Map<string, PaintDrawKind[]>;
  loaders: Map<string, () => Promise<PaintDrawKind>>;
}
interface Real {
  disposers: { dispose: () => void; entry: PaintDrawKind; id: string }[];
  loaderDisposers: { dispose: () => void; load: () => Promise<PaintDrawKind>; id: string }[];
}

const t = tally();

function check(m: Model): void {
  for (const id of IDS) {
    const stack = m.stacks.get(id) ?? [];
    // A loader that never resolves keeps a lookup's load from changing the registry under the test.
    expect(getPaintDrawKind(id)).toBe(stack.at(-1));
    expect(isPaintKindKnown(id)).toBe(stack.length > 0 || m.loaders.has(id));
  }
}

type Cmd = fc.Command<Model, Real>;

const register = fc.constantFrom(...IDS).map((id): Cmd => ({
  check: () => true,
  run(m, r) {
    const entry = { id, bind: () => null } as unknown as PaintDrawKind;
    r.disposers.push({ dispose: registerPaintDrawKind(entry), entry, id });
    const stack = m.stacks.get(id) ?? [];
    t.count(stack.length > 0 ? 'override' : 'register');
    m.stacks.set(id, [...stack, entry]);
    check(m);
  },
  toString: () => `register(${id})`,
}));

const dispose = fc.nat().map((n): Cmd => ({
  check: () => true,
  run(m, r) {
    if (r.disposers.length === 0) return;
    const d = r.disposers[n % r.disposers.length]!;
    d.dispose();
    const stack = m.stacks.get(d.id) ?? [];
    const at = stack.lastIndexOf(d.entry);
    t.count(at < 0 ? 'dispose again' : at === stack.length - 1 ? 'dispose top' : 'dispose under');
    if (at >= 0) m.stacks.set(d.id, stack.filter((_, i) => i !== at));
    check(m);
  },
  toString: () => `dispose(${n})`,
}));

const loader = fc.constantFrom(...IDS).map((id): Cmd => ({
  check: () => true,
  run(m, r) {
    const load = () => new Promise<PaintDrawKind>(() => {});
    r.loaderDisposers.push({ dispose: registerPaintDrawKindLoader(id, load), load, id });
    m.loaders.set(id, load);
    t.count('loader');
    check(m);
  },
  toString: () => `loader(${id})`,
}));

const disposeLoader = fc.nat().map((n): Cmd => ({
  check: () => true,
  run(m, r) {
    if (r.loaderDisposers.length === 0) return;
    const d = r.loaderDisposers[n % r.loaderDisposers.length]!;
    d.dispose();
    if (m.loaders.get(d.id) === d.load) { m.loaders.delete(d.id); t.count('loader gone'); } else t.count('loader kept');
    check(m);
  },
  toString: () => `disposeLoader(${n})`,
}));

afterEach(() => _resetPaintDrawKindsForTests());

describe('paint draw-kind registry, stateful property', () => {
  it('answers the latest entry still registered under each id', () => {
    fc.assert(fc.property(fc.commands([register, register, dispose, dispose, loader, disposeLoader], { size: 'large', maxCommands: 40 }), (cmds) => {
      _resetPaintDrawKindsForTests();
      fc.modelRun(() => ({ model: { stacks: new Map(), loaders: new Map() }, real: { disposers: [], loaderDisposers: [] } }), cmds);
    }), runs(200));
    for (const k of ['register', 'override', 'dispose top', 'dispose under', 'dispose again', 'loader', 'loader gone', 'loader kept']) t.atLeast(k, 20);
  });
});
