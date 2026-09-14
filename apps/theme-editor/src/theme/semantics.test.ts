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

describe('defaultRule', () => {
  it('starts a rule of the chosen kind and keeps type, description and check', () => {
    const current = { ref: 'gray-100', type: 'color', description: 'd', check: { contrast: 3, against: ['surface'] } };
    expect(ruleKind(defaultRule('offset', current, { gray: ['50', '100'] }, ['surface']))).toBe('offset');
    expect(defaultRule('literal', current, {}, [])).toEqual({ type: 'color', description: 'd', check: current.check, value: '' });
    expect(defaultRule('step', current, { gray: ['50', '100'] }, [])).toMatchObject({ ramp: 'gray', step: '50' });
  });
});
