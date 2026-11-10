import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import { multiply, rotate, rotateAboutPoint, scale, translate, type Affine } from '@weasel-js/geom';
import { formatMatrix, parseTransform } from './transform';
import { IDENTITY_MATRIX } from './types';

const RUNS = { numRuns: Number(globalThis.process?.env?.WEASEL_PBT_RUNS) || 300 };
const DEG = Math.PI / 180;

const num = fc.double({ min: -1000, max: 1000, noNaN: true, noDefaultInfinity: true });
const angle = fc.double({ min: -360, max: 360, noNaN: true });
/** A skew short of ±90°, where its tangent stays a number a matrix can hold. */
const skew = fc.double({ min: -80, max: 80, noNaN: true });

/** One transform function as SVG text, with the matrix it stands for. */
const fn: fc.Arbitrary<{ text: (sep: string) => string; m: Affine }> = fc.oneof(
  fc.tuple(num, fc.option(num, { nil: undefined })).map(([tx, ty]) => ({
    text: (sep: string) => `translate(${ty === undefined ? tx : `${tx}${sep}${ty}`})`, m: translate(tx, ty ?? 0),
  })),
  fc.tuple(num, fc.option(num, { nil: undefined })).map(([sx, sy]) => ({
    text: (sep: string) => `scale(${sy === undefined ? sx : `${sx}${sep}${sy}`})`, m: scale(sx, sy ?? sx),
  })),
  fc.tuple(angle, fc.option(fc.tuple(num, num), { nil: undefined })).map(([a, at]) => ({
    text: (sep: string) => `rotate(${at === undefined ? a : [a, ...at].join(sep)})`,
    m: at === undefined ? rotate(a * DEG) : rotateAboutPoint(at[0], at[1], a * DEG),
  })),
  skew.map((a) => ({ text: () => `skewX(${a})`, m: [1, 0, Math.tan(a * DEG), 1, 0, 0] as Affine })),
  skew.map((a) => ({ text: () => `skewY(${a})`, m: [1, Math.tan(a * DEG), 0, 1, 0, 0] as Affine })),
  fc.tuple(num, num, num, num, num, num).map((m) => ({ text: (sep: string) => `matrix(${m.join(sep)})`, m })),
);

const sep = fc.constantFrom(' ', ',', ', ', ' , ', '\n');
const between = fc.constantFrom(' ', '', ',', ' ,\t');

function close(a: Affine, b: Affine): void {
  const size = Math.max(1, ...a.map(Math.abs), ...b.map(Math.abs));
  for (let i = 0; i < 6; i++) expect(Math.abs(a[i]! - b[i]!), `entry ${i} of ${a} vs ${b}`).toBeLessThanOrEqual(size * 1e-9);
}

describe('parseTransform, property', () => {
  it('reads a transform list as the product of its functions, left to right', () => {
    fc.assert(fc.property(fc.array(fn, { minLength: 1, maxLength: 4 }), sep, between, (fns, s, b) => {
      const text = fns.map((f) => f.text(s)).join(b);
      const warns: string[] = [];
      const got = parseTransform(text, (w) => warns.push(w));
      expect(warns).toEqual([]);
      close(got, fns.map((f) => f.m).reduce((acc, m) => multiply(acc, m), IDENTITY_MATRIX));
    }), RUNS);
  });

  it('reads back what formatMatrix writes, to its six decimals', () => {
    fc.assert(fc.property(fc.tuple(num, num, num, num, num, num), (m) => {
      const text = formatMatrix(m);
      if (text === null) return;
      const got = parseTransform(text);
      for (let i = 0; i < 6; i++) expect(Math.abs(got[i]! - m[i]!)).toBeLessThanOrEqual(5e-7);
    }), RUNS);
  });

  it('never throws, and always answers a finite matrix, whatever the text', () => {
    const unit = fc.constantFrom(...'translatescalerotateskewXYmatrix(),. -+e0123456789\t'.split(''));
    fc.assert(fc.property(fc.string({ unit, maxLength: 60 }), (text) => {
      const got = parseTransform(text);
      for (const v of got) expect(Number.isFinite(v)).toBe(true);
    }), { numRuns: RUNS.numRuns * 3 });
  });

  it('ignores the whole list when one function in it is malformed', () => {
    const bad = fc.constantFrom('translate()', 'scale(1 2 3)', 'rotate(1 2)', 'skewX(a)', 'matrix(1 2 3)', 'spin(3)', 'x');
    fc.assert(fc.property(fc.array(fn, { maxLength: 2 }), bad, fc.array(fn, { maxLength: 2 }), sep, (head, wrong, tail, s) => {
      const text = [...head.map((f) => f.text(s)), wrong, ...tail.map((f) => f.text(s))].join(' ');
      expect(parseTransform(text, () => {})).toEqual(IDENTITY_MATRIX);
    }), RUNS);
  });
});
