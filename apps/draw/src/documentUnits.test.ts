import { rulerTicks } from '@weasel-js/guides';
import { resolveUnit } from '@weasel-js/quantity';
import { describe, expect, it } from 'vitest';
import { DOCUMENT_SCOPE, DOCUMENT_UNITS, RULER_LENGTHS } from './documentUnits';
import { PAPER_PRESETS } from './paperSizes';

describe('document units', () => {
  it('read a US Letter page as 8.5 by 11 inches', () => {
    const { width, height } = PAPER_PRESETS.letter;
    expect(width / DOCUMENT_UNITS.in).toBe(8.5);
    expect(height / DOCUMENT_UNITS.in).toBe(11);
    expect(resolveUnit({ value: 8.5, unit: 'in' }, DOCUMENT_SCOPE.system)).toBe(width);
  });

  it('put the rulers’ 8 in tick 8 inches into a Letter page at 100%', () => {
    const { ticks, unit } = rulerTicks({ pxPerUnit: 1, start: 0, length: PAPER_PRESETS.letter.width, scopes: [DOCUMENT_SCOPE], lengths: RULER_LENGTHS });
    expect(unit).toBe('in');
    expect(ticks.find((t) => t.label === '8')?.at).toBeCloseTo(8 * 96);
  });

  it('label the rulers in points zoomed in, and never throw at the deepest zoom', () => {
    expect(rulerTicks({ pxPerUnit: 4, start: 0, length: 400, scopes: [DOCUMENT_SCOPE], lengths: RULER_LENGTHS }).unit).toBe('pt');
    expect(() => rulerTicks({ pxPerUnit: 1e5, start: 0, length: 400, scopes: [DOCUMENT_SCOPE], lengths: RULER_LENGTHS })).not.toThrow();
  });
});
