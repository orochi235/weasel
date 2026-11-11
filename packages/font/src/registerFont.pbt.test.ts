/**
 * The atlas registry through `fc.commands` runs of eager and lazy registrations that load or fail, warms, and the
 * settling of loads in flight, over families named like `Object.prototype` members and like the registry's own keys
 * (`a|400`): after every step each variant is loaded, declared, loading, or absent as a model says, and `getFont`,
 * `listFonts`, `fontPending`, and `warmFonts` answer for it alone.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import fc from 'fast-check';
import { FIXTURE_FONT } from './FontAtlas';
import { _resetFontRegistryForTests, fontPending, getFont, listFonts, registerFont, warmFonts } from './registerFont';
import { runs, tally, timeoutFor } from './pbt.fixture';
import type { FontStyle } from './fontStyle';

const RUNS = 400;
const FAMILIES = ['a', 'a|400', '__proto__', 'toString'];
const VARIANTS: { weight: number; style: FontStyle }[] = [
  { weight: 400, style: 'normal' }, { weight: 700, style: 'normal' }, { weight: 400, style: 'italic' },
];
const keyOf = (v: { weight: number; style: FontStyle }) => `${v.weight}|${v.style}`;

type State = 'declared' | 'loading' | 'loaded';
interface Model {
  registered: Set<string>;
  variants: Map<string, Map<string, { state: State; ok: boolean }>>;
}
interface Real { t: ReturnType<typeof tally> }

const flush = () => new Promise<void>((r) => setTimeout(r, 0));
let calls = 0;

/** Fetches held until a settle releases them, so a load is in flight for exactly as long as the model says. */
let held: (() => void)[] = [];
function release(): Promise<void> {
  const now = held;
  held = [];
  now.forEach((go) => go());
  return flush();
}

function stubFetch(): void {
  globalThis.fetch = vi.fn((url: string) => new Promise((resolve) => held.push(() => resolve(url.startsWith('/bad/')
    ? { ok: false, status: 404 }
    : url.endsWith('.json')
      ? { ok: true, json: () => Promise.resolve(FIXTURE_FONT) }
      : { ok: true, blob: () => Promise.resolve(new Blob(['PNG'])) })))) as unknown as typeof fetch;
  globalThis.createImageBitmap = vi.fn(() => Promise.resolve({ width: 512, height: 512, close() {} })) as unknown as typeof createImageBitmap;
}

const variantsOf = (m: Model, family: string) => {
  let v = m.variants.get(family);
  if (!v) m.variants.set(family, (v = new Map()));
  return v;
};

/** Every load in flight lands, or fails and is forgotten. */
function settleModel(m: Model): void {
  for (const variants of m.variants.values()) {
    for (const [key, v] of variants) {
      if (v.state !== 'loading') continue;
      if (v.ok) v.state = 'loaded'; else variants.delete(key);
    }
  }
}

function check(m: Model): void {
  for (const family of FAMILIES) {
    const variants = m.variants.get(family);
    for (const v of VARIANTS) {
      expect(getFont(family, v.weight, v.style) !== null, `getFont(${family}, ${keyOf(v)})`).toBe(variants?.get(keyOf(v))?.state === 'loaded');
    }
    expect(fontPending(family), `fontPending(${family})`).toBe([...(variants?.values() ?? [])].some((v) => v.state !== 'loaded'));
  }
  const listed = listFonts().map((f) => [f.family, f.variants.map(keyOf).sort()]);
  const want = [...m.registered].flatMap((family) => {
    const keys = [...(m.variants.get(family) ?? [])].filter(([, v]) => v.state !== 'loading').map(([k]) => k).sort();
    return keys.length > 0 ? [[family, keys]] : [];
  });
  expect(listed).toEqual(want);
}

class Register implements fc.AsyncCommand<Model, Real> {
  constructor(readonly family: string, readonly variant: (typeof VARIANTS)[number], readonly lazy: boolean, readonly ok: boolean) {}
  check = () => true;
  async run(m: Model, r: Real): Promise<void> {
    const dir = this.ok ? 'ok' : 'bad';
    const n = calls++;
    registerFont(this.family, this.variant, `/${dir}/${n}.json`, `/${dir}/${n}.png`, { lazy: this.lazy }).catch(() => {});
    m.registered.add(this.family);
    const variants = variantsOf(m, this.family);
    const key = keyOf(this.variant);
    const was = variants.get(key);
    if (was?.state === 'loaded' || was?.state === 'loading') r.t.count('joined');
    else if (this.lazy) { if (!was) variants.set(key, { state: 'declared', ok: this.ok }); }
    else variants.set(key, { state: 'loading', ok: this.ok });
    check(m);
  }
  toString = () => `register(${JSON.stringify(this.family)}, ${keyOf(this.variant)}, lazy=${this.lazy}, ok=${this.ok})`;
}

class Settle implements fc.AsyncCommand<Model, Real> {
  check = () => true;
  async run(m: Model): Promise<void> {
    await release();
    settleModel(m);
    check(m);
  }
  toString = () => 'settle';
}

class Warm implements fc.AsyncCommand<Model, Real> {
  constructor(readonly family: string, readonly known: boolean) {}
  check = (m: Readonly<Model>) => !this.known || m.registered.has(this.family);
  async run(m: Model, r: Real): Promise<void> {
    let outcome: 'resolved' | 'rejected' | null = null;
    warmFonts([this.family]).then(() => { outcome = 'resolved'; }, () => { outcome = 'rejected'; });
    const variants = m.variants.get(this.family);
    for (const v of variants?.values() ?? []) if (v.state === 'declared') v.state = 'loading';
    const fails = !m.registered.has(this.family) || [...(variants?.values() ?? [])].some((v) => v.state === 'loading' && !v.ok);
    await release();
    settleModel(m);
    expect(outcome).toBe(fails ? 'rejected' : 'resolved');
    r.t.count(`warm ${outcome}`);
    check(m);
  }
  toString = () => `warm(${JSON.stringify(this.family)})`;
}

const family = fc.constantFrom(...FAMILIES);
const register = fc.tuple(family, fc.constantFrom(...VARIANTS), fc.boolean(), fc.oneof({ weight: 3, arbitrary: fc.constant(true) }, { weight: 1, arbitrary: fc.constant(false) }))
  .map(([f, v, lazy, ok]) => new Register(f, v, lazy, ok));
const commands = fc.commands([
  register, register, register,
  fc.constant(new Settle()),
  family.map((f) => new Warm(f, false)),
  family.map((f) => new Warm(f, true)),
  family.map((f) => new Warm(f, true)),
], { maxCommands: 30 });

beforeEach(() => {
  _resetFontRegistryForTests();
  stubFetch();
});

describe('atlas registry, stateful', () => {
  it('holds each variant as the model does, and answers for each family alone', async () => {
    const t = tally();
    await fc.assert(fc.asyncProperty(commands, async (cmds) => {
      _resetFontRegistryForTests();
      await fc.asyncModelRun(() => ({ model: { registered: new Set(), variants: new Map() }, real: { t } }), cmds);
      await release();
    }), runs(RUNS));
    t.atLeast('warm resolved', 50);
    t.atLeast('warm rejected', 50);
    t.atLeast('joined', 8);
  }, timeoutFor(RUNS, 40));
});
