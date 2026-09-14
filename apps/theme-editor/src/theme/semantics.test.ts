import { describe, expect, it } from 'vitest';
import { deriveDraft } from './draft';
import { lookupOf, weasel } from './fixtures';
import { setPin, setSemantic } from './model';
import { defaultRule, ruleKind, semanticRows } from './semantics';
import type { ThemeDefinition } from '@weasel-js/theme';

const rowsOf = (def: ThemeDefinition) => {
  const d = deriveDraft(def, lookupOf(def), {});
  return semanticRows(def, d.merged, d.views);
};

describe('semanticRows', () => {
  it("reads weasel's references per mode, with nothing to measure", () => {
    const surface = rowsOf(weasel).find((r) => r.name === 'surface')!;
    expect(surface.summary).toBe('by mode: gray-800 / gray-50');
    expect(surface.cells.map((c) => c.step)).toEqual(['gray-800', 'gray-50']);
    expect(surface.worst).toBeNull();
    expect(surface.pinned).toBe(false);
  });

  it('measures a contrast rule against its surfaces in every mode', () => {
    const def = setSemantic(weasel, 'fg-muted', { ramp: 'gray', contrast: { min: 4.5, against: ['surface'] } });
    const row = rowsOf(def).find((r) => r.name === 'fg-muted')!;
    expect(row.cells.map((c) => c.checks.map((k) => k.against))).toEqual([['surface'], ['surface']]);
    expect(row.worst?.pass).toBe(true);
    expect(row.worst!.ratio).toBeGreaterThanOrEqual(4.5);
  });

  it('keeps what the rule produced beneath a pin', () => {
    const row = rowsOf(setPin(weasel, 'fg', { value: '#ffffff', type: 'color' })).find((r) => r.name === 'fg')!;
    expect(row.cells[0]).toMatchObject({ mode: 'dark', produced: '{gray-100}', pin: '#ffffff' });
    expect(row.ownPin).toBe(true);
  });
});

describe('semanticRows worst', () => {
  const rowFor = (rule: object) => rowsOf(setSemantic(weasel, 'fg-muted', rule as never)).find((r) => r.name === 'fg-muted')!;

  it('does not pass a row with a check it could not measure', () => {
    const row = rowFor({ ref: 'gray-300', type: 'color', check: { contrast: 1, against: ['surface', 'shadow'] } });
    expect(row.worst).toMatchObject({ min: 1, pass: false, unmeasured: 2 });
  });

  it('reports the check that failed, not the lowest ratio', () => {
    const row = rowFor({ ramp: 'gray', type: 'color', contrast: { min: 21, against: ['surface'] }, check: { contrast: 1, against: ['surface-raised'] } });
    const ratios = row.cells.flatMap((c) => c.checks.map((k) => k.ratio!));
    expect(row.worst).toMatchObject({ min: 21, pass: false, unmeasured: 0 });
    expect(row.worst!.ratio).toBeCloseTo(15.99, 2);
    expect(Math.min(...ratios)).toBeLessThan(row.worst!.ratio!);
  });
});

describe('defaultRule', () => {
  it('starts a rule of the chosen kind and keeps type, description and check', () => {
    const current = { ref: 'gray-100', type: 'color', description: 'd', check: { contrast: 3, against: ['surface'] } };
    expect(ruleKind(defaultRule('offset', current, { gray: ['50', '100'] }, ['surface']))).toBe('offset');
    expect(defaultRule('literal', current, {}, [])).toEqual({ type: 'color', description: 'd', check: current.check, value: '' });
    expect(defaultRule('step', current, { gray: ['50', '100'] }, [])).toMatchObject({ ramp: 'gray', step: '50' });
  });

  it('falls back to a step rule when there is nothing else to point at', () => {
    const current = { ref: 'gray-800', type: 'color' };
    const ramps = { gray: ['50', '100'] };
    const others = ['surface'].filter((n) => n !== 'surface');
    expect(ruleKind(defaultRule('offset', current, ramps, others))).toBe('step');
    expect(ruleKind(defaultRule('contrast', current, ramps, others))).toBe('step');
  });
});
