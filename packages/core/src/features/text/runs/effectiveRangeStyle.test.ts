import { describe, expect, it } from 'vitest';
import { MIXED } from './rangeStyle';
import { effectiveRangeStyle } from './effectiveRangeStyle';

describe('effectiveRangeStyle', () => {
  it('falls back to the kit defaults when nothing is set', () => {
    const s = effectiveRangeStyle(null, undefined);
    expect(s.fontSize).toBe(16);
    expect(s.fontFamily).toBe('sans-serif');
    expect(s.letterSpacing).toBe(0);
    expect(s.bold).toBe(false);
    expect(s.underline).toBe(false);
  });

  it('shows the node value where the range sets nothing', () => {
    expect(effectiveRangeStyle({}, { fontSize: 24 }).fontSize).toBe(24);
  });

  it('lets a run value override the node value', () => {
    expect(effectiveRangeStyle({ fontSize: 30 }, { fontSize: 24 }).fontSize).toBe(30);
  });

  it('carries MIXED through for an overriding key', () => {
    expect(effectiveRangeStyle({ fontSize: MIXED }, { fontSize: 24 }).fontSize).toBe(MIXED);
  });

  it('adds a run flag to the node flag', () => {
    expect(effectiveRangeStyle({ bold: true }, {}).bold).toBe(true);
    expect(effectiveRangeStyle({ bold: false }, { fontWeight: 700 }).bold).toBe(true);
    expect(effectiveRangeStyle({ overline: false }, { overline: true }).overline).toBe(true);
  });

  it('reads a node weight as bold from 600 and a keyword weight too', () => {
    expect(effectiveRangeStyle(null, { fontWeight: 600 }).bold).toBe(true);
    expect(effectiveRangeStyle(null, { fontWeight: 500 }).bold).toBe(false);
    expect(effectiveRangeStyle(null, { fontWeight: 'bold' }).bold).toBe(true);
  });

  it('collapses a mixed flag to true when the node sets it', () => {
    // Every run renders bold whether or not the runs agree — `run || node`.
    // Reporting MIXED would describe the data, not the text.
    expect(effectiveRangeStyle({ bold: MIXED }, { fontWeight: 700 }).bold).toBe(true);
    expect(effectiveRangeStyle({ bold: MIXED }, { fontWeight: 400 }).bold).toBe(MIXED);
  });

  it('passes the run-only styling straight through', () => {
    const s = effectiveRangeStyle(
      { script: 'super', baselineShift: 0.333, fontScale: 0.583 },
      { fontSize: 24 },
    );
    expect(s.script).toBe('super');
    expect(s.baselineShift).toBe(0.333);
    expect(s.fontScale).toBe(0.583);
  });

  it("reads the node's transform, and lets a run's override it", () => {
    expect(effectiveRangeStyle(null, {}).textTransform).toBe('none');
    expect(effectiveRangeStyle({}, { textTransform: 'uppercase' }).textTransform).toBe('uppercase');
    expect(effectiveRangeStyle({ textTransform: 'none' }, { textTransform: 'uppercase' }).textTransform)
      .toBe('none');
  });

  it('reports no script where the range sets none', () => {
    expect(effectiveRangeStyle({}, { fontSize: 24 }).script).toBeUndefined();
  });

  it("takes the node's fill from its paint, and omits it for an unfilled node", () => {
    const fill = { color: '#ff0000ff' };
    expect(effectiveRangeStyle(null, {}, { fill }).fill).toBe(fill);
    expect('fill' in effectiveRangeStyle(null, {}, { fill: null })).toBe(false);
  });

  it("lets a run's fill override the node's", () => {
    const fill = { color: '#00ff00ff' };
    expect(effectiveRangeStyle({ fill }, {}, { fill: { color: '#ff0000ff' } }).fill).toBe(fill);
  });
});
