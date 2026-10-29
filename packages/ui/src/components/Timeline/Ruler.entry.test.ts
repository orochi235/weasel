import { describe, expect, it } from 'vitest';
import * as ui from '../../index';

describe('the time ruler from the package entry', () => {
  it('exports the ruler and its scale helpers', () => {
    expect(typeof ui.Ruler).toBe('function');
    const w = { from: 1000, to: 3000 };
    expect(ui.toFraction(w, 1500)).toBe(0.25);
    expect(ui.toPercent(w, 1500)).toBe('25%');
    expect(ui.spanFraction(w, 500)).toBe(0.25);
    expect(ui.spanPercent(w, 500)).toBe('25%');
  });
});
