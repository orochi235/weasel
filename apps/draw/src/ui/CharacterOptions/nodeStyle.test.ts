import { describe, expect, it } from 'vitest';
import { MIXED } from '@weasel-js/core';
import { effectiveRangeStyle, rangeStyleFromTextStyle } from './nodeStyle';

describe('rangeStyleFromTextStyle', () => {
  it('reports nothing for an absent style', () => {
    expect(rangeStyleFromTextStyle(undefined)).toEqual({});
  });

  it('omits keys the style does not set, rather than inventing defaults', () => {
    // An unset key is not "off" — the bar has to be able to tell "this node
    // says nothing about underline" from "this node says underline: false",
    // because only the second is worth writing back.
    expect(rangeStyleFromTextStyle({ fontSize: 18 })).toEqual({ fontSize: 18 });
  });

  it('buckets a numeric weight into the bold flag', () => {
    expect(rangeStyleFromTextStyle({ fontWeight: 700 }).bold).toBe(true);
    expect(rangeStyleFromTextStyle({ fontWeight: 600 }).bold).toBe(true);
    expect(rangeStyleFromTextStyle({ fontWeight: 500 }).bold).toBe(false);
    expect(rangeStyleFromTextStyle({ fontWeight: 400 }).bold).toBe(false);
  });

  it('ignores a non-numeric weight rather than guessing', () => {
    expect(rangeStyleFromTextStyle({ fontWeight: 'bold' }).bold).toBeUndefined();
  });

  it('carries the remaining keys through unchanged', () => {
    const fill = { color: '#ff0000ff' };
    expect(
      rangeStyleFromTextStyle({
        fontStyle: 'italic',
        fontFamily: 'serif',
        fontSize: 24,
        letterSpacing: 1.5,
        underline: true,
        strikethrough: false,
      }, { fill }),
    ).toEqual({
      italic: true,
      fontFamily: 'serif',
      fontSize: 24,
      letterSpacing: 1.5,
      underline: true,
      strikethrough: false,
      fill,
    });
  });
});

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
    const s = effectiveRangeStyle({}, { fontSize: 24 });
    expect(s.fontSize).toBe(24);
  });

  it('lets a run value override the node value', () => {
    const s = effectiveRangeStyle({ fontSize: 30 }, { fontSize: 24 });
    expect(s.fontSize).toBe(30);
  });

  it('carries MIXED through for an overriding key', () => {
    expect(effectiveRangeStyle({ fontSize: MIXED }, { fontSize: 24 }).fontSize).toBe(MIXED);
  });

  it('adds a run flag to the node flag', () => {
    expect(effectiveRangeStyle({ bold: true }, {}).bold).toBe(true);
    expect(effectiveRangeStyle({ bold: false }, { fontWeight: 700 }).bold).toBe(true);
    expect(effectiveRangeStyle({ overline: false }, { overline: true }).overline).toBe(true);
  });

  it('passes the run-only styling straight through', () => {
    // `script` and the two primitives it presets have no node-level
    // counterpart to resolve against, so there is nothing to merge.
    const s = effectiveRangeStyle(
      { script: 'super', baselineShift: 0.333, fontScale: 0.583 },
      { fontSize: 24 },
    );
    expect(s.script).toBe('super');
    expect(s.baselineShift).toBe(0.333);
    expect(s.fontScale).toBe(0.583);
  });

  it('reports no script where the range sets none', () => {
    expect(effectiveRangeStyle({}, { fontSize: 24 }).script).toBeUndefined();
  });

  it('collapses a mixed flag to true when the node sets it', () => {
    // Every run renders bold whether or not the runs agree — `run || node`.
    // Reporting MIXED would describe the data, not the text.
    expect(effectiveRangeStyle({ bold: MIXED }, { fontWeight: 700 }).bold).toBe(true);
    expect(effectiveRangeStyle({ bold: MIXED }, { fontWeight: 400 }).bold).toBe(MIXED);
  });

  it('reports the node style alone when there is no range', () => {
    const s = effectiveRangeStyle(null, { fontWeight: 700, underline: true });
    expect(s.bold).toBe(true);
    expect(s.underline).toBe(true);
  });
});
