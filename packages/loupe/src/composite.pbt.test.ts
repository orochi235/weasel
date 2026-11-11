/**
 * Metamorphic property tests of `compositeOver`: a transparent layer anywhere in a stack changes nothing; an opaque
 * one hides every layer beneath it; compositing the top of a stack first and laying the result over the rest reads
 * as the whole stack does, within a byte's rounding; and a layer's premultiplied bytes read as its straight ones do.
 */
import { describe, expect, it } from 'vitest';
import fc from 'fast-check';
import { compositeOver, type Rgba } from './sampler';
import { byte, rgbaBytes, runs, tally, timeoutFor } from './pbt.fixture';

const RUNS = 400;

const layer = fc.oneof({ weight: 6, arbitrary: rgbaBytes }, fc.constant(null));
const stack = fc.array(layer, { maxLength: 5 });

const within = (a: Rgba | null, b: Rgba | null, d: number): boolean =>
  a === null || b === null ? a === b : a.every((v, i) => Math.abs(v - b[i]!) <= d);

describe('compositeOver', () => {
  it('reads the same with a transparent layer put anywhere in the stack', () => {
    fc.assert(fc.property(stack, fc.nat(), fc.tuple(byte, byte, byte), (s, at, rgb) => {
      const i = at % (s.length + 1);
      const clear: [number, number, number, number] = [...rgb, 0];
      expect(compositeOver([...s.slice(0, i), clear, ...s.slice(i)])).toEqual(compositeOver(s));
    }), runs(RUNS));
  }, timeoutFor(RUNS, 1));

  it('hides everything beneath an opaque layer', () => {
    fc.assert(fc.property(stack, fc.tuple(byte, byte, byte), stack, (above, rgb, below) => {
      const opaque: [number, number, number, number] = [...rgb, 255];
      expect(compositeOver([...above, opaque, ...below])).toEqual(compositeOver([...above, opaque]));
    }), runs(RUNS));
  }, timeoutFor(RUNS, 1));

  it('reads the top of a stack composited first, then laid over the rest, as the whole stack, within rounding', () => {
    const seen = tally();
    fc.assert(fc.property(stack, stack, (top, rest) => {
      const whole = compositeOver([...top, ...rest]);
      const first = compositeOver(top);
      const split = compositeOver([first, ...rest]);
      // Each step rounds to bytes; a translucent top divided back by a small alpha magnifies that rounding.
      const a = first?.[3] ?? 255;
      const slack = a === 0 || a === 255 ? 1 : Math.ceil(255 / a) + 1;
      if (first && a < 255 && rest.some((l) => l && l[3] > 0)) seen.count('translucent over something');
      expect(within(split, whole, slack), `${JSON.stringify(split)} / ${JSON.stringify(whole)}`).toBe(true);
    }), runs(RUNS));
    seen.atLeast('translucent over something', RUNS / 5);
  }, timeoutFor(RUNS, 1));

  it('reads a layer written premultiplied as its straight bytes, within rounding', () => {
    fc.assert(fc.property(rgbaBytes, stack, (px, rest) => {
      const [r, g, b, a] = px;
      const pre: [number, number, number, number] = [Math.round((r * a) / 255), Math.round((g * a) / 255), Math.round((b * a) / 255), a];
      const straight = compositeOver([px, ...rest]);
      const premul = compositeOver([pre, ...rest], [true]);
      expect(within(premul, straight, a === 0 ? 0 : Math.ceil(255 / a) + 1)).toBe(true);
    }), runs(RUNS));
  }, timeoutFor(RUNS, 1));
});
