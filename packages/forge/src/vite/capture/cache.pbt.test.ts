/**
 * The capture cache against a model of a least-recently-used list bounded by count and by bytes, through
 * `fc.commands` runs of up to 150 reads, writes, rewrites of a key, oversized and empty images, and clears, checked
 * after every step: what it holds, in which order it would evict, its size, and its byte total.
 */
import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { PROTO_KEYS, runs, tally, timeoutFor } from '../../pbt.fixture';
import { type CaptureCache, createCaptureCache } from './cache';

const RUNS = 200;

interface Model {
  /** Least recently used first. */
  held: { key: string; bytes: number; png: Buffer }[];
  limits: { entries: number; bytes: number };
}
type Cmd = fc.Command<Model, CaptureCache>;

const t = tally();
const key = fc.constantFrom('a', 'b', 'c', 'd', 'x y', ...PROTO_KEYS);

function check(m: Model, r: CaptureCache): void {
  expect(r.size).toBe(m.held.length);
  expect(r.bytes).toBe(m.held.reduce((sum, e) => sum + e.bytes, 0));
  expect(r.size).toBeLessThanOrEqual(m.limits.entries);
  expect(r.bytes).toBeLessThanOrEqual(m.limits.bytes);
}

const touch = (m: Model, k: string) => {
  const at = m.held.findIndex((e) => e.key === k);
  if (at < 0) return undefined;
  const [entry] = m.held.splice(at, 1);
  m.held.push(entry!);
  return entry!;
};

const set = fc.tuple(key, fc.oneof(fc.nat(40), fc.constantFrom(0, 100, 101, 200))).map(([k, bytes]): Cmd => ({
  check: () => true,
  run(m, r) {
    const png = Buffer.alloc(bytes, 7);
    m.held = m.held.filter((e) => e.key !== k);
    if (bytes <= m.limits.bytes) {
      m.held.push({ key: k, bytes, png });
      while (m.held.length > m.limits.entries || m.held.reduce((s, e) => s + e.bytes, 0) > m.limits.bytes) {
        m.held.shift();
        t.count('evicted');
      }
    } else t.count('too big');
    r.set(k, png);
    check(m, r);
  },
  toString: () => `set(${JSON.stringify(k)}, ${bytes})`,
}));

const get = key.map((k): Cmd => ({
  check: () => true,
  run(m, r) {
    const entry = touch(m, k);
    const got = r.get(k);
    if (entry) {
      expect(got).toBe(entry.png);
      t.count('hit');
    } else expect(got).toBeUndefined();
    check(m, r);
  },
  toString: () => `get(${JSON.stringify(k)})`,
}));

/** Reads every held key, least recently used first, which leaves the order as it was. */
const sweep = fc.constant<Cmd>({
  check: () => true,
  run(m, r) {
    for (const e of [...m.held]) expect(r.get(e.key)).toBe(e.png);
    check(m, r);
  },
  toString: () => 'sweep()',
});

const clear = fc.constant<Cmd>({
  check: () => true,
  run(m, r) {
    m.held = [];
    r.clear();
    check(m, r);
  },
  toString: () => 'clear()',
});

describe('createCaptureCache', () => {
  it('holds, reads, and evicts as a bounded least-recently-used list does', () => {
    fc.assert(
      fc.property(
        fc.record({ entries: fc.oneof({ weight: 1, arbitrary: fc.constant(0) }, { weight: 6, arbitrary: fc.integer({ min: 2, max: 6 }) }), bytes: fc.oneof({ weight: 1, arbitrary: fc.constant(0) }, { weight: 6, arbitrary: fc.integer({ min: 40, max: 150 }) }) }),
        fc.commands([set, set, set, get, get, sweep, clear], { maxCommands: 150, size: '+1' }),
        (limits, cmds) => {
          fc.modelRun(() => ({ model: { held: [], limits }, real: createCaptureCache(limits) }), cmds);
        },
      ),
      runs(RUNS),
    );
    t.atLeast('evicted', 200);
    t.atLeast('hit', 200);
    t.atLeast('too big', 20);
  }, timeoutFor(RUNS, 20));
});
