/** Counterexamples the quadrant class model shrank to, kept as plain examples. */
import { describe, expect, it } from 'vitest';
import { quadrantStyleOf } from './compile';
import { setQuadrantPointClass } from './structure';
import type { QuadrantData } from './types';

describe('quadrant classes, shrunk', () => {
  it('refuses a class named for what every object inherits, where the chart holds none by that name', () => {
    const data: QuadrantData = { kind: 'quadrant', classes: { hot: { radius: 4 } }, points: [{ name: 'p', x: 0.5, y: 0.5 }] };
    for (const name of ['constructor', 'toString', '__proto__']) expect(() => setQuadrantPointClass(data, 0, name)).toThrow(/no class/);
    expect(quadrantStyleOf(data, { name: 'q', x: 0, y: 0, className: 'constructor' })).toEqual({});
  });
});
