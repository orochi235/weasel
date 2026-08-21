import { describe, it, expect, vi, afterEach } from 'vitest';
import { linearScale, logScale, resolveScale } from './scale';

const MIN = 1 / 64;
const MAX = 1 / 2;

describe('BandScale', () => {
  it.each([
    ['linear', linearScale],
    ['log', logScale],
  ] as const)('%s round-trips a value through unit space', (_name, scale) => {
    for (const v of [MIN, 0.02, 0.05, 0.1, 0.3, MAX]) {
      expect(scale.fromUnit(scale.toUnit(v, MIN, MAX), MIN, MAX)).toBeCloseTo(v, 10);
    }
  });

  it.each([
    ['linear', linearScale],
    ['log', logScale],
  ] as const)('%s is monotonic increasing', (_name, scale) => {
    const samples = [MIN, 0.02, 0.05, 0.1, 0.3, MAX];
    const units = samples.map((v) => scale.toUnit(v, MIN, MAX));
    for (let i = 1; i < units.length; i++) expect(units[i]).toBeGreaterThan(units[i - 1]);
  });

  it('pins both ends of the track', () => {
    for (const scale of [linearScale, logScale]) {
      expect(scale.toUnit(MIN, MIN, MAX)).toBeCloseTo(0, 12);
      expect(scale.toUnit(MAX, MIN, MAX)).toBeCloseTo(1, 12);
    }
  });

  it('spends more of a log track on the narrow end than a linear one', () => {
    // The reason `'log'` is the default: on a linear axis the narrow stops of a
    // width ladder all pile into the leftmost sixth.
    expect(logScale.toUnit(1 / 16, MIN, MAX)).toBeGreaterThan(linearScale.toUnit(1 / 16, MIN, MAX));
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
    const custom = { toUnit: () => 0, fromUnit: () => 0 };
    expect(resolveScale(custom, 0)).toBe(custom);
  });

  it('falls back to linear on a non-positive min, warning once', async () => {
    // Fresh module: the warn-once flag is module state, and another test in
    // this file may already have spent it.
    vi.resetModules();
    const fresh = await import('./scale');
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});

    expect(fresh.resolveScale('log', 0)).toBe(fresh.linearScale);
    expect(fresh.resolveScale(undefined, -4)).toBe(fresh.linearScale);
    expect(fresh.resolveScale('log', 0)).toBe(fresh.linearScale);

    expect(warn).toHaveBeenCalledTimes(1);
    expect(warn.mock.calls[0][0]).toMatch(/min > 0/);
  });

  it('positions seams at real numbers under the fallback', () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    const scale = resolveScale('log', 0);
    expect(scale.toUnit(50, 0, 100)).toBeCloseTo(0.5, 12);
    expect(Number.isNaN(scale.toUnit(50, 0, 100))).toBe(false);
  });
});
