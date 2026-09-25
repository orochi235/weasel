import { describe, expect, it } from 'vitest';
import type { IndexEntry } from '../story/types';
import { isolateReport } from './isolateReport';

const entry = (id: string, isolate?: string): IndexEntry => ({
  id,
  title: 'ui/X',
  name: id,
  exportName: id,
  file: '/repo/x.stories.tsx',
  ...(isolate === undefined ? {} : { isolate }),
});

describe('isolateReport', () => {
  it('reports zero as ok with only the count line', () => {
    expect(isolateReport([entry('ui-x--a'), entry('ui-x--b')], 0)).toEqual({
      lines: ['0 isolated stories (allowed: 0)'],
      ok: true,
    });
  });

  it('lists each isolated story with its reason aligned, and passes at the allowed count', () => {
    const entries = [entry('ui-x--a', 'global stylesheet'), entry('ui-x--b'), entry('ui-x--longer', 'own realm')];
    expect(isolateReport(entries, 2)).toEqual({
      lines: ['ui-x--a       global stylesheet', 'ui-x--longer  own realm', '2 isolated stories (allowed: 2)'],
      ok: true,
    });
  });

  it('fails above the allowed count and says so on a last line', () => {
    const { lines, ok } = isolateReport([entry('ui-x--a', 'why')], 0);
    expect(ok).toBe(false);
    expect(lines.slice(0, 2)).toEqual(['ui-x--a  why', '1 isolated story (allowed: 0)']);
    expect(lines[2]).toMatch(/^1 is above the 0 allowed\./);
  });
});
