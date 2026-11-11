/**
 * The outline registry through `fc.commands` runs of registrations, replacements, and removals while loads are in
 * flight, loads asked for directly and by a glyph, and the settling of those loads, over families named like
 * `Object.prototype` members and like the registry's own keys: after every step each face's status, the listing, and
 * every glyph answer are what a model says, and a load that lands for a registration since replaced or removed
 * changes nothing.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import fc from 'fast-check';
import { runs, tally, timeoutFor } from '../pbt.fixture';
import type { FontStyle } from '../fontStyle';
import type { OutlineFace } from './OutlineFace';
import {
  _resetFontOutlinesForTests, glyphOutline, hasFontOutlines, listFontOutlines, loadFontOutlines, outlineStatus,
  registerFontOutlines, unregisterFontOutlines,
} from './outlineRegistry';

const RUNS = 300;
const FAMILIES = ['a|400', '__proto__', ''];
const VARIANTS: { weight: number; style: FontStyle }[] = [
  { weight: 400, style: 'normal' }, { weight: 400, style: 'italic' },
];
type Status = 'idle' | 'loading' | 'ready' | 'failed';
interface Slot { status: Status; good: boolean; id: number }
type Model = Map<string, Slot>;
interface Real { t: ReturnType<typeof tally> }

const keyOf = (family: string, v: { weight: number; style: FontStyle }) => JSON.stringify([family, v.weight, v.style]);
const flush = () => new Promise<void>((r) => setTimeout(r, 0));

let held: (() => void)[] = [];
let ids = 0;

/** A face whose one glyph, at U+0041, names the registration it was parsed for. */
function faceFor(id: number): OutlineFace {
  return {
    unitsPerEm: 1000, ascender: 0.8,
    glyphD: (cp) => (cp === 0x41 ? `M0 0L${id} 0L0 1` : null),
    advanceOf: (cp) => (cp === 0x41 ? 0.5 : null),
    kernOf: () => 0,
  };
}

/** Bytes held until a settle: one byte for a face that fails to parse, two for one that reads, and the id after. */
function source(good: boolean, id: number): () => Promise<ArrayBuffer> {
  return () => new Promise((resolve) => held.push(() => resolve(new Uint32Array([good ? 1 : 0, id]).buffer)));
}
const parser = (bytes: ArrayBuffer): OutlineFace => {
  const [good, id] = new Uint32Array(bytes);
  if (!good) throw new Error('unreadable');
  return faceFor(id!);
};

function check(m: Model): void {
  for (const family of FAMILIES) {
    for (const v of VARIANTS) {
      const slot = m.get(keyOf(family, v));
      expect(hasFontOutlines(family, v.weight, v.style)).toBe(slot !== undefined);
      expect(outlineStatus(family, v.weight, v.style)).toBe(slot?.status ?? null);
    }
  }
  const listed = listFontOutlines().map((f) => keyOf(f.family, f) + f.status).sort();
  expect(listed).toEqual([...m].map(([k, s]) => k + s.status).sort());
}

abstract class Step implements fc.AsyncCommand<Model, Real> {
  constructor(readonly family: string, readonly variant: (typeof VARIANTS)[number]) {}
  check = () => true;
  abstract run(m: Model, r: Real): Promise<void>;
  get key(): string { return keyOf(this.family, this.variant); }
  toString = () => `${this.constructor.name}(${JSON.stringify(this.family)}, ${this.variant.weight}/${this.variant.style})`;
}

class Register extends Step {
  constructor(family: string, variant: (typeof VARIANTS)[number], readonly good: boolean) { super(family, variant); }
  async run(m: Model, r: Real): Promise<void> {
    const id = ++ids;
    if (m.get(this.key)?.status === 'loading') r.t.count('replaced in flight');
    registerFontOutlines(this.family, this.variant, source(this.good, id), { parser });
    m.set(this.key, { status: 'idle', good: this.good, id });
    check(m);
  }
}

class Unregister extends Step {
  async run(m: Model): Promise<void> {
    unregisterFontOutlines(this.family, this.variant);
    m.delete(this.key);
    check(m);
  }
}

class Load extends Step {
  async run(m: Model): Promise<void> {
    const slot = m.get(this.key);
    void loadFontOutlines(this.family, this.variant);
    if (slot?.status === 'idle') slot.status = 'loading';
    check(m);
  }
}

class Glyph extends Step {
  async run(m: Model, r: Real): Promise<void> {
    const slot = m.get(this.key);
    const d = glyphOutline(this.family, this.variant.weight, this.variant.style, 0x41);
    expect(d).toBe(slot?.status === 'ready' ? `M0 0L${slot.id} 0L0 1Z` : null);
    if (d) r.t.count('glyph');
    if (slot?.status === 'idle') slot.status = 'loading';
    check(m);
  }
}

class Settle implements fc.AsyncCommand<Model, Real> {
  check = () => true;
  async run(m: Model): Promise<void> {
    const now = held;
    held = [];
    now.forEach((go) => go());
    await flush();
    for (const slot of m.values()) if (slot.status === 'loading') slot.status = slot.good ? 'ready' : 'failed';
    check(m);
  }
  toString = () => 'settle';
}

const at = fc.tuple(fc.constantFrom(...FAMILIES), fc.constantFrom(...VARIANTS));
const commands = fc.commands([
  fc.tuple(at, fc.oneof({ weight: 3, arbitrary: fc.constant(true) }, { weight: 1, arbitrary: fc.constant(false) }))
    .map(([[f, v], good]) => new Register(f, v, good)),
  at.map(([f, v]) => new Unregister(f, v)),
  at.map(([f, v]) => new Load(f, v)),
  at.map(([f, v]) => new Glyph(f, v)),
  at.map(([f, v]) => new Glyph(f, v)),
  fc.constant(new Settle()),
], { maxCommands: 40, size: 'large' });

beforeEach(() => vi.spyOn(console, 'warn').mockImplementation(() => {}));
afterEach(() => {
  vi.restoreAllMocks();
  _resetFontOutlinesForTests();
});

describe('outline registry, stateful', () => {
  it('holds each face as the model does, and lets no late load reach a registration that replaced its own', async () => {
    const t = tally();
    await fc.assert(fc.asyncProperty(commands, async (cmds) => {
      _resetFontOutlinesForTests();
      held = [];
      await fc.asyncModelRun(() => ({ model: new Map(), real: { t } }), cmds);
    }), runs(RUNS));
    t.atLeast('glyph', 40);
    t.atLeast('replaced in flight', 20);
  }, timeoutFor(RUNS, 20));
});
