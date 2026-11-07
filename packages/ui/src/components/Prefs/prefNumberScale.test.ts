import { afterEach, describe, expect, it, vi } from 'vitest';
import { prefNumberScale } from './prefNumberScale';

const track = { range: [0, 1] as const };

describe('prefNumberScale', () => {
  afterEach(() => vi.restoreAllMocks());

  it('leaves a linear or unset scale to the slider', () => {
    expect(prefNumberScale(undefined)).toBeUndefined();
    expect(prefNumberScale('linear')).toBeUndefined();
  });

  it('spaces a log track by ratio and a sqrt track by root', () => {
    const log = prefNumberScale('log')!({ domain: [1, 1000], ...track });
    expect(log.kind).toBe('log');
    expect(log.invert(0.5)).toBeCloseTo(Math.sqrt(1000), 9);
    const sqrt = prefNumberScale('sqrt')!({ domain: [0, 100], ...track });
    expect(sqrt.map(25)).toBeCloseTo(0.5, 12);
  });

  it('runs a custom pair as a warp, and hands back one factory per pair', () => {
    const pair = { to: (v: number) => v * v, from: Math.sqrt };
    const warp = prefNumberScale(pair)!;
    expect(prefNumberScale(pair)).toBe(warp);
    expect(warp({ domain: [0, 10], ...track }).invert(0.25)).toBeCloseTo(5, 12);
  });

  it('draws a log track over a range not above zero linearly, warning once', async () => {
    vi.resetModules();
    const fresh = await import('./prefNumberScale');
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const log = fresh.prefNumberScale('log')!;
    expect(log({ domain: [0, 100], ...track }).kind).toBe('linear');
    expect(log({ domain: [-5, 5], ...track }).map(0)).toBe(0.5);
    expect(warn).toHaveBeenCalledTimes(1);
    expect(warn.mock.calls[0][0]).toMatch(/log/);
  });
});
