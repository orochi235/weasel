import { describe, it, expect, vi, afterEach } from 'vitest';
import { linearScale, logScale, type ContinuousScaleFactory } from '@weasel-js/plot/scales';
import { resolveScale, unitScale, withinAxis } from './scale';

const MIN = 1 / 64;
const MAX = 1 / 2;

describe('a log axis', () => {
  it('spends more of the track on the narrow end than a linear one', () => {
    // The reason `'log'` is the default: on a linear axis the narrow stops of a
    // width ladder all pile into the leftmost sixth.
    expect(unitScale(logScale, MIN, MAX).map(1 / 16)).toBeGreaterThan(unitScale(linearScale, MIN, MAX).map(1 / 16));
  });
});

describe('resolveScale', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('defaults to log', () => {
    expect(resolveScale(undefined, MIN)).toBe(logScale);
    expect(resolveScale('log', MIN)).toBe(logScale);
    expect(resolveScale('linear', MIN)).toBe(linearScale);
  });

  it('passes a custom scale straight through', () => {
    const custom: ContinuousScaleFactory = (opts) => linearScale(opts);
    expect(resolveScale(custom, 0)).toBe(custom);
  });

  it('falls back to linear on a non-positive min, warning once', async () => {
    // Fresh module: the warn-once flag is module state, and another test in
    // this file may already have spent it.
    vi.resetModules();
    const fresh = await import('./scale');
    const { linearScale: freshLinear } = await import('@weasel-js/plot/scales');
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});

    expect(fresh.resolveScale('log', 0)).toBe(freshLinear);
    expect(fresh.resolveScale(undefined, -4)).toBe(freshLinear);
    expect(fresh.resolveScale('log', 0)).toBe(freshLinear);

    expect(warn).toHaveBeenCalledTimes(1);
    expect(warn.mock.calls[0][0]).toMatch(/min > 0/);
  });

  it('positions seams at real numbers under the fallback', () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    const unit = unitScale(resolveScale('log', 0), 0, 100);
    expect(unit.map(50)).toBeCloseTo(0.5, 12);
  });
});

describe('withinAxis', () => {
  it('places a value where it sits on the whole axis', () => {
    const whole = unitScale(logScale, 1, 1000);
    const part = unitScale(withinAxis(logScale, 1, 1000), 10, 100);
    // 10..100 is the middle third of a log axis over 1..1000.
    expect(part.map(10)).toBeCloseTo(0, 12);
    expect(part.map(100)).toBeCloseTo(1, 12);
    for (const v of [10, 20, 31.6, 50, 100]) {
      expect(part.map(v)).toBeCloseTo((whole.map(v) - 1 / 3) * 3, 9);
      expect(part.invert(part.map(v))).toBeCloseTo(v, 9);
    }
  });
});
