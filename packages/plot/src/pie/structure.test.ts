import { describe, expect, it } from 'vitest';
import { compilePlot } from '../plotData';
import { PLOT_THEME } from '../theme';
import { insertPieSlice, movePieSlice, removePieSlice, setPieShowData } from './structure';
import type { PieData } from './types';

const measure = (text: string) => ({ width: text.length * 7, height: 14 });
const compiles = (d: PieData) => compilePlot(d, { width: 600, height: 400 }, PLOT_THEME, measure);
const EMPTY: PieData = { kind: 'pie', slices: [] };

describe('pie structure', () => {
  it('builds a pie from nothing, each slice under a label no other holds', () => {
    let d = insertPieSlice(EMPTY, 0);
    d = insertPieSlice(d, 1);
    d = insertPieSlice(d, 0, { label: 'First', value: 5 });
    expect(d.slices).toEqual([{ label: 'First', value: 5 }, { label: 'Slice 1', value: 1 }, { label: 'Slice 2', value: 1 }]);
    expect(compiles(d).some((m) => m.data.plotMark.kind === 'arc')).toBe(true);
  });

  it('moves and removes slices, and throws on one it does not hold', () => {
    const d: PieData = { kind: 'pie', slices: [{ label: 'a', value: 1 }, { label: 'b', value: 2 }, { label: 'c', value: 3 }] };
    expect(movePieSlice(d, 0, 2).slices.map((s) => s.label)).toEqual(['b', 'c', 'a']);
    expect(movePieSlice(d, 1, 1)).toBe(d);
    expect(removePieSlice(d, 1).slices.map((s) => s.label)).toEqual(['a', 'c']);
    expect(() => removePieSlice(d, 3)).toThrow(/no item 3/);
    expect(() => insertPieSlice(d, 5)).toThrow(/cannot insert at 5/);
    compiles(removePieSlice(removePieSlice(removePieSlice(d, 0), 0), 0));
  });

  it('shows values in the legend, writing nothing for the default', () => {
    expect(setPieShowData(EMPTY, true).showData).toBe(true);
    expect(setPieShowData(setPieShowData(EMPTY, true), false)).toEqual(EMPTY);
    expect(setPieShowData(EMPTY, false)).toBe(EMPTY);
  });
});
