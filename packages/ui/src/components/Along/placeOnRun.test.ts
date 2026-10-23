import { describe, expect, test } from 'vitest';
import { arcShape, trackRun } from '@weasel-js/geom';
import { placeOnRun } from './placeOnRun';

describe('placeOnRun', () => {
  test("a part toward the low end of a run across 3 o'clock takes the half turn that stands it upright", () => {
    const run = trackRun(arcShape({ center: { x: 0, y: 0 }, radius: 100, start: 45, end: 135 }));
    const prop = (g: number, name: string) => (placeOnRun(run, g) as Record<string, string>)[name];
    expect([0, 0.5, 1].map((g) => prop(g, '--at-upright'))).toEqual(['0deg', '0deg', '180deg']);
    expect(prop(1, '--at-angle')).toBe(`${run.at(1).angle}deg`);
  });
});
