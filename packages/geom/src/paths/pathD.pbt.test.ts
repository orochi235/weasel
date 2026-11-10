import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import { pathFromD } from './pathFromD';
import { pathToD } from './pathToD';
import { PathBuilder } from './builder';
import { worldCoords } from './pathOrigin';
import type { PolygonPath } from '../path';
import { eighth, runs } from '../pbt.fixture';

const RUNS = runs(300);

type Pt = readonly [number, number];
/** One drawing command as written: its letter (upper case) and its absolute points. */
type Seg =
  | { k: 'L' | 'H' | 'V'; to: Pt }
  | { k: 'C'; c1: Pt; c2: Pt; to: Pt }
  | { k: 'S'; c2: Pt; to: Pt }
  | { k: 'Q'; c: Pt; to: Pt }
  | { k: 'T'; to: Pt };
interface Sub { start: Pt | null; segs: Seg[]; close: boolean }

const pt = (limit: number): fc.Arbitrary<Pt> => fc.tuple(eighth(limit), eighth(limit));

const seg = (limit: number): fc.Arbitrary<Seg> => fc.oneof(
  fc.record({ k: fc.constantFrom('L' as const, 'H' as const, 'V' as const), to: pt(limit) }),
  fc.record({ k: fc.constant('C' as const), c1: pt(limit), c2: pt(limit), to: pt(limit) }),
  fc.record({ k: fc.constant('S' as const), c2: pt(limit), to: pt(limit) }),
  fc.record({ k: fc.constant('Q' as const), c: pt(limit), to: pt(limit) }),
  fc.record({ k: fc.constant('T' as const), to: pt(limit) }),
);

/** Subpaths; a later one may leave out its moveto after a closed one, and starts from that one's start. */
const subpaths = fc.oneof(fc.constant(0), fc.integer({ min: -1e6, max: 1e6 })).chain((far) => {
  const limit = 500;
  const shift = (p: Pt): Pt => [p[0] + far, p[1] + far];
  const sub = fc.record({
    start: fc.option(pt(limit).map(shift), { nil: null, freq: 4 }),
    segs: fc.array(seg(limit).map((s) => moveSeg(s, shift)), { maxLength: 6 }),
    close: fc.boolean(),
  });
  return fc.array(sub, { minLength: 1, maxLength: 4 }).map((subs) => {
    // Only a subpath after a closed one may go without a moveto.
    subs[0] = { ...subs[0], start: subs[0].start ?? shift([0, 0]) };
    for (let i = 1; i < subs.length; i++) {
      if (subs[i].start === null && !subs[i - 1].close) subs[i] = { ...subs[i], start: shift([0, 0]) };
    }
    return subs;
  });
});

function moveSeg(s: Seg, f: (p: Pt) => Pt): Seg {
  switch (s.k) {
    case 'C': return { k: 'C', c1: f(s.c1), c2: f(s.c2), to: f(s.to) };
    case 'S': return { k: 'S', c2: f(s.c2), to: f(s.to) };
    case 'Q': return { k: 'Q', c: f(s.c), to: f(s.to) };
    default: return { k: s.k, to: f(s.to) };
  }
}

/** The path the subpaths draw, built straight from the builder with SVG's reflection and H/V rules. */
function expected(subs: readonly Sub[]): PolygonPath {
  const b = new PathBuilder().autoOrigin();
  let cur: Pt = [0, 0];
  let start: Pt = [0, 0];
  for (const sub of subs) {
    if (sub.start) { b.moveTo(...sub.start); cur = start = sub.start; }
    let lastC: Pt | null = null, lastQ: Pt | null = null;
    for (const s of sub.segs) {
      const to = landing(s, cur);
      if (s.k === 'C' || s.k === 'S') {
        const c1: Pt = s.k === 'C' ? s.c1 : reflect(cur, lastC);
        b.curveTo(...c1, ...s.c2, ...to);
        lastC = s.c2; lastQ = null;
      } else if (s.k === 'Q' || s.k === 'T') {
        const c: Pt = s.k === 'Q' ? s.c : reflect(cur, lastQ);
        b.quadTo(...c, ...to);
        lastQ = c; lastC = null;
      } else {
        b.lineTo(...to);
        lastC = lastQ = null;
      }
      cur = to;
    }
    if (sub.close) { b.close(); cur = start; }
  }
  return b.build();
}

function landing(s: Seg, cur: Pt): Pt {
  if (s.k === 'H') return [s.to[0], cur[1]];
  if (s.k === 'V') return [cur[0], s.to[1]];
  return s.to;
}

function reflect(cur: Pt, ctrl: Pt | null): Pt {
  return ctrl ? [2 * cur[0] - ctrl[0], 2 * cur[1] - ctrl[1]] : cur;
}

interface Style { relative: boolean; sep: string; tightMinus: boolean; dropLetters: boolean; bareFraction: boolean }
const style: fc.Arbitrary<Style> = fc.record({
  relative: fc.boolean(),
  sep: fc.constantFrom(' ', ',', ', ', '\n\t', ' ,'),
  tightMinus: fc.boolean(),
  dropLetters: fc.boolean(),
  bareFraction: fc.boolean(),
});

/** The subpaths as `d` text in `st`'s spelling. */
function write(subs: readonly Sub[], st: Style): string {
  let out = '';
  let prev = '';
  let cur: Pt = [0, 0];
  let start: Pt = [0, 0];
  const num = (n: number): string => {
    const s = String(n);
    return st.bareFraction ? s.replace(/^(-?)0\./, '$1.') : s;
  };
  const emit = (letter: string, nums: number[]): void => {
    const cased = st.relative && letter !== 'Z' ? letter.toLowerCase() : letter;
    // After a moveto, further pairs are linetos of the same case: a dropped `L` reads as one.
    const repeats = prev === cased || (prev.toUpperCase() === 'M' && cased.toUpperCase() === 'L' && prev === (st.relative ? 'm' : 'M'));
    let text = st.dropLetters && repeats && letter !== 'Z' && letter !== 'M' ? st.sep : cased;
    nums.forEach((n, i) => {
      const s = num(n);
      text += i === 0 || (st.tightMinus && s.startsWith('-')) ? s : st.sep + s;
    });
    out += text;
    prev = cased;
  };
  const rel = (p: Pt): number[] => (st.relative ? [p[0] - cur[0], p[1] - cur[1]] : [p[0], p[1]]);
  for (const sub of subs) {
    if (sub.start) { emit('M', rel(sub.start)); cur = start = sub.start; }
    for (const s of sub.segs) {
      const to = landing(s, cur);
      switch (s.k) {
        case 'H': emit('H', [rel(to)[0]]); break;
        case 'V': emit('V', [rel(to)[1]]); break;
        case 'L': emit('L', rel(to)); break;
        case 'C': emit('C', [...rel(s.c1), ...rel(s.c2), ...rel(to)]); break;
        case 'S': emit('S', [...rel(s.c2), ...rel(to)]); break;
        case 'Q': emit('Q', [...rel(s.c), ...rel(to)]); break;
        case 'T': emit('T', rel(to)); break;
      }
      cur = to;
    }
    if (sub.close) { emit('Z', []); cur = start; }
  }
  return out;
}

function same(a: PolygonPath, b: PolygonPath): void {
  expect(Array.from(a.commands)).toEqual(Array.from(b.commands));
  expect(Array.from(worldCoords(a))).toEqual(Array.from(worldCoords(b)));
}

describe('pathFromD / pathToD, property', () => {
  it('parses every spelling of the same path to the same path', () => {
    fc.assert(fc.property(subpaths, style, (subs, st) => {
      const d = write(subs, st);
      same(pathFromD(d, (w) => { throw new Error(`${w} in ${JSON.stringify(d)}`); }), expected(subs));
    }), RUNS);
  });

  it('round-trips a path through its d text exactly', () => {
    fc.assert(fc.property(subpaths, (subs) => {
      const path = expected(subs);
      const d = pathToD(path);
      const back = pathFromD(d);
      same(back, path);
      expect(pathToD(back)).toBe(d);
    }), RUNS);
  });

  it('reaches a fixed point after one round trip of any path data, arcs included', () => {
    const n = fc.double({ min: -1e4, max: 1e4, noNaN: true }).map((v) => String(v));
    const flag = fc.constantFrom('0', '1');
    const cmd = fc.oneof(
      fc.tuple(fc.constantFrom('M', 'm', 'L', 'l', 'T', 't'), n, n).map((p) => `${p[0]}${p[1]} ${p[2]}`),
      fc.tuple(fc.constantFrom('H', 'h', 'V', 'v'), n).map((p) => `${p[0]}${p[1]}`),
      fc.tuple(fc.constantFrom('C', 'c'), n, n, n, n, n, n).map(([c, ...a]) => `${c}${a.join(' ')}`),
      fc.tuple(fc.constantFrom('S', 's', 'Q', 'q'), n, n, n, n).map(([c, ...a]) => `${c}${a.join(' ')}`),
      fc.tuple(fc.constantFrom('A', 'a'), n, n, n, flag, flag, n, n).map(([c, ...a]) => `${c}${a.join(' ')}`),
      fc.constantFrom('Z', 'z'),
    );
    fc.assert(fc.property(n, n, fc.array(cmd, { maxLength: 8 }), (x, y, cmds) => {
      const once = pathToD(pathFromD(`M${x} ${y}${cmds.join('')}`));
      const twice = pathToD(pathFromD(once));
      const a = pathFromD(once), b = pathFromD(twice);
      expect(Array.from(b.commands)).toEqual(Array.from(a.commands));
      const wa = worldCoords(a), wb = worldCoords(b);
      for (let i = 0; i < wa.length; i++) {
        expect(Number.isFinite(wb[i])).toBe(true);
        expect(Math.abs(wa[i] - wb[i])).toBeLessThanOrEqual(Math.abs(wa[i]) * 1e-6 + 1e-5);
      }
    }), RUNS);
  });

  it('never throws, and never yields a non-finite coordinate, on arbitrary text', () => {
    const text = fc.string({ unit: fc.constantFrom(...'MmLlHhVvCcSsQqTtAaZzEe0123456789.-+, \n'.split('')), maxLength: 60 });
    fc.assert(fc.property(text, (d) => {
      const path = pathFromD(d);
      for (const v of worldCoords(path)) expect(Number.isFinite(v)).toBe(true);
    }), runs(500));
  });
});
