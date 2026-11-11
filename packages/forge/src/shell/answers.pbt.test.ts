/**
 * The answer book against a model: the last 50 configs' answers kept by recency of recording, a config's pins and
 * playhead no part of its key, a path hidden under a hidden branch, errors read as own keys only, and subscribers
 * told only of a changed answer to a config some trial holds.
 */
import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { stableStringify } from '../protocol/messages';
import { key, runs, tally, timeoutFor } from '../pbt.fixture';
import { type AnswerBook, createAnswerBook } from './answers';
import { GLOBALS_KEY, PLAYHEAD_KEY, storyConfig } from './globals';

const RUNS = 150;
const KEPT = 50;

interface Answer { hidden: string[]; errors: Record<string, string[]> }
interface Model {
  kept: Map<string, { answer: Answer; key: string }>;
  held: Map<string, number>;
  emitted: number;
}
interface Real {
  book: AnswerBook;
  emitted: number;
  /** Each live hold's release, with the config key it holds: the test's bookkeeping, not the book's. */
  releases: Map<number, { key: string; release: () => void }>;
}

const t = tally();

/** Configs from a pool wide enough to evict, some carrying forge's own keys. */
const config = fc.tuple(fc.integer({ min: 0, max: 60 }), fc.constantFrom(null, GLOBALS_KEY, PLAYHEAD_KEY)).map(([n, extra]) => {
  const c: Record<string, unknown> = { n };
  if (extra) c[extra] = { mode: 'dark' };
  return c;
});
const keyOf = (c: unknown): string => stableStringify(storyConfig(c));

const path = fc.constantFrom('a', 'a.b', 'a.b.c', 'ab', 'toString', 'constructor', '__proto__', 'x');
const answer: fc.Arbitrary<Answer> = fc.record({
  hidden: fc.uniqueArray(path, { maxLength: 2 }),
  errors: fc.array(fc.tuple(path, fc.array(fc.constantFrom('bad', 'worse'), { minLength: 1, maxLength: 2 })), { maxLength: 2 }).map((e) => {
    const out: Record<string, string[]> = {};
    for (const [k, v] of e) Object.defineProperty(out, k, { value: v, enumerable: true, writable: true, configurable: true });
    return out;
  }),
});

function checkReads(m: Model, r: Real, c: unknown): void {
  const kept = m.kept.get(keyOf(c))?.answer;
  for (const p of ['a', 'a.b', 'a.b.c', 'ab', 'toString', 'constructor', '__proto__', 'x']) {
    expect(r.book.hidden(p, c), p).toBe(kept?.hidden.some((h) => p === h || p.startsWith(`${h}.`)) ?? false);
    expect(r.book.errors(p, c), p).toEqual(kept && Object.hasOwn(kept.errors, p) ? kept.errors[p] : []);
  }
}

type Cmd = fc.Command<Model, Real>;
function recordOne(m: Model, r: Real, c: unknown, a: Answer): void {
  const k = keyOf(c);
  const answerKey = stableStringify({ hidden: a.hidden, errors: a.errors });
  const before = m.kept.get(k)?.key ?? stableStringify({ hidden: [], errors: {} });
  m.kept.delete(k);
  m.kept.set(k, { answer: a, key: answerKey });
  if (m.kept.size > KEPT) {
    m.kept.delete(m.kept.keys().next().value!);
    t.count('evicted');
  }
  if (answerKey !== before && m.held.has(k)) m.emitted += 1;
  r.book.record({ configKey: k, ...a });
  expect(r.emitted).toBe(m.emitted);
  checkReads(m, r, c);
  t.count('record');
  if (m.kept.size === KEPT) t.count('full');
}

const record = fc.tuple(config, answer).map(([c, a]): Cmd => ({
  check: () => true,
  run(m, r) {
    recordOne(m, r, c, a);
  },
  toString: () => `record(${JSON.stringify(c)}, ${JSON.stringify(a)})`,
}));
/** Records answers for a run of distinct configs at once, so the book fills and starts evicting. */
const fill = fc.tuple(fc.integer({ min: 0, max: 60 }), fc.integer({ min: 40, max: 60 }), answer).map(([from, count, a]): Cmd => ({
  check: () => true,
  run(m, r) {
    for (let i = 0; i < count; i++) recordOne(m, r, { n: (from + i) % 61 }, a);
  },
  toString: () => `fill(${from}, ${count})`,
}));
let holdId = 0;
const hold = config.map((c): Cmd => ({
  check: () => true,
  run(m, r) {
    const k = keyOf(c);
    m.held.set(k, (m.held.get(k) ?? 0) + 1);
    r.releases.set(holdId++, { key: k, release: r.book.hold(c) });
    checkReads(m, r, c);
  },
  toString: () => `hold(${JSON.stringify(c)})`,
}));
const release = fc.nat().map((pick): Cmd => ({
  check: () => true,
  run(m, r) {
    const ids = [...r.releases.keys()];
    if (ids.length === 0) return;
    const id = ids[pick % ids.length]!;
    const { key: k, release: free } = r.releases.get(id)!;
    free();
    r.releases.delete(id);
    const left = m.held.get(k)! - 1;
    if (left > 0) m.held.set(k, left);
    else m.held.delete(k);
    t.count('release');
  },
  toString: () => `release(${pick})`,
}));

describe('createAnswerBook', () => {
  it('keeps, reads, and announces answers as the model does', () => {
    fc.assert(
      fc.property(fc.commands([record, record, record, hold, hold, release, release, fill], { maxCommands: 60 }), (cmds) => {
        const book = createAnswerBook();
        const real: Real = { book, emitted: 0, releases: new Map() };
        book.subscribe(() => (real.emitted += 1));
        const model: Model = { kept: new Map(), held: new Map(), emitted: 0 };
        fc.modelRun(() => ({ model, real }), cmds);
      }),
      runs(RUNS),
    );
    t.atLeast('full', 200);
    t.atLeast('release', 20);
    t.atLeast('evicted', 200);
  }, timeoutFor(RUNS, 20));

  it('reads no errors for a leaf named like a prototype member', () => {
    fc.assert(
      fc.property(key, (k) => {
        const book = createAnswerBook();
        book.record({ configKey: keyOf({}), hidden: [], errors: {} });
        expect(book.errors(k, {})).toEqual([]);
      }),
      runs(50),
    );
  });
});

describe('shrunk counterexamples', () => {
  it('reads no errors for a leaf named `toString` in an answered config', () => {
    const book = createAnswerBook();
    book.record({ configKey: keyOf({ n: 0 }), hidden: [], errors: {} });
    expect(book.errors('toString', { n: 0 })).toEqual([]);
  });
});
