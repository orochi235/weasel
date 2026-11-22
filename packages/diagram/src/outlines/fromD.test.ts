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
