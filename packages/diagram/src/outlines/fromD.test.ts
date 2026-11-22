import { describe, expect, it } from 'vitest';
import { outlineFromD, parseUnitD } from './fromD';

const SQUARE = 'M0 0H1V1H0Z';

describe('parseUnitD', () => {
  it.each(['M0.5 0.5', 'M0 0M1 1'])('reports path data that only moves, %s', (d) => {
    const problems: string[] = [];
    expect(parseUnitD(d, (m) => problems.push(m)).ok).toBe(false);
    expect(problems).toEqual(['it draws nothing']);
    expect(() => outlineFromD(d)).toThrow(/draws nothing/);
  });

  it('accepts path data that draws', () => {
    expect(parseUnitD(SQUARE).ok).toBe(true);
  });
});

describe('outlineFromD content', () => {
  it.each([
    { x: Number.NaN, y: 0, width: 0.5, height: 0.5 },
    { x: 0, y: Number.POSITIVE_INFINITY, width: 0.5, height: 0.5 },
    { x: 0.8, y: 0, width: 0.5, height: 1 },
    { x: -0.1, y: 0, width: 0.5, height: 0.5 },
    { x: 0, y: 0.6, width: 0.5, height: 0.5 },
  ])('refuses a box that is not inside the unit square, %o', (content) => {
    expect(() => outlineFromD(SQUARE, { content })).toThrow(RangeError);
  });

  it('accepts a box that fills the unit square', () => {
    expect(() => outlineFromD(SQUARE, { content: { x: 0, y: 0, width: 1, height: 1 } })).not.toThrow();
    expect(() => outlineFromD(SQUARE, { content: { x: 0.25, y: 0.5, width: 0.75, height: 0.5 } })).not.toThrow();
  });
});
