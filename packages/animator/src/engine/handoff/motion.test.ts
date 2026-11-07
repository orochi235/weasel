import { describe, expect, it } from 'vitest';
import { keptSamples, physicsMotion, sampleTimes } from './motion';

describe('keyframes a run is sampled into', () => {
  it('keep only the ends of a straight line', () => {
    const times = sampleTimes(1000, 60, 600);
    expect(keptSamples(times, times.map((t) => [t * 0.1, 5]))).toEqual([0, times.length - 1]);
  });

  it('keep the turns of a path made of straight pieces', () => {
    const times = sampleTimes(2000, 60, 600);
    const rows = times.map((t) => [t < 1000 ? t : 2000 - t]);
    const kept = keptSamples(times, rows).map((k) => times[k]);
    expect(kept).toEqual([0, 1000, 2000]);
  });

  it('stay within a fraction of a percent of a curve', () => {
    const times = sampleTimes(1000, 60, 600);
    const rows = times.map((t) => [100 * Math.sin((t / 1000) * Math.PI)]);
    const kept = keptSamples(times, rows);
    expect(kept.length).toBeLessThan(times.length);
    for (let k = 0; k + 1 < kept.length; k++) {
      const [i, j] = [kept[k]!, kept[k + 1]!];
      for (let m = i + 1; m < j; m++) {
        const u = (times[m]! - times[i]!) / (times[j]! - times[i]!);
        const line = rows[i]![0]! + (rows[j]![0]! - rows[i]![0]!) * u;
        expect(Math.abs(rows[m]![0]! - line)).toBeLessThanOrEqual(0.2 + 1e-9);
      }
    }
  });
});

describe('a spring in closed form', () => {
  it('ends within its threshold of its destination, at rest', () => {
    const m = physicsMotion({ start: [0], velocity: [0], to: [100], stiffness: 170, damping: 26, mass: 1, threshold: 0.01 });
    expect(Math.abs(m.at(m.ms)[0]! - 100)).toBeLessThan(0.01);
    expect(Math.abs(m.velocity(m.ms)[0]!)).toBeLessThan(0.01);
    expect(Math.abs(m.at(m.ms - 50)[0]! - 100)).toBeGreaterThan(0);
  });
});
