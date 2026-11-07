import { describe, it, expect, vi, afterEach } from 'vitest';
import { linearScale, logScale, type ContinuousScaleFactory } from '@weasel-js/plot/scales';
import { prefNumberScale } from '../Prefs/prefNumberScale';
import { unitScale, withinAxis } from './scale';

const MIN = 1 / 64;
const MAX = 1 / 2;

describe('a log axis', () => {
  it('spends more of the track on the narrow end than a linear one', () => {
    // The reason `'log'` is the default: on a linear axis the narrow stops of a
    // width ladder all pile into the leftmost sixth.
    expect(unitScale(logScale, MIN, MAX).map(1 / 16)).toBeGreaterThan(unitScale(linearScale, MIN, MAX).map(1 / 16));
  });
});

describe('BandEditor\'s scale, through prefNumberScale', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('spaces a log axis by ratio and a linear one by difference', () => {
    const log = unitScale(prefNumberScale('log', 'BandEditor')!, 1, 100);
    expect(log.map(10)).toBeCloseTo(0.5, 12);
    expect(prefNumberScale('linear', 'BandEditor')).toBeUndefined();
  });

  it('passes a custom scale straight through', () => {
    const custom: ContinuousScaleFactory = (opts) => linearScale(opts);
    expect(prefNumberScale(custom, 'BandEditor')).toBe(custom);
  });

  it('draws a log axis not above zero linearly, warning once under its caller\'s name', async () => {
    // Fresh module: the warn-once flag is module state, and another test may already have spent it.
    vi.resetModules();
    const fresh = await import('../Prefs/prefNumberScale');
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const log = fresh.prefNumberScale('log', 'BandEditor')!;

    const unit = unitScale(log, 0, 100);
    expect(unit.map(50)).toBeCloseTo(0.5, 12);
    expect(unitScale(log, -4, 4).map(0)).toBeCloseTo(0.5, 12);

    expect(warn).toHaveBeenCalledTimes(1);
    expect(warn.mock.calls[0][0]).toMatch(/^BandEditor: a log track needs a range above zero/);
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
