import { describe, expect, it } from 'vitest';
import { compilePlot } from '../plotData';
import { PLOT_THEME } from '../theme';
import {
  insertRadarAxis, insertRadarCurve, moveRadarAxis, moveRadarCurve, removeRadarAxis, removeRadarCurve, setRadarAxisId, setRadarCurveId,
  setRadarOption,
} from './structure';
import type { RadarData } from './types';

const measure = (text: string) => ({ width: text.length * 7, height: 14 });
const compiles = (d: RadarData) => expect(compilePlot(d, { width: 600, height: 400 }, PLOT_THEME, measure).length).toBeGreaterThan(0);

const R: RadarData = { kind: 'radar', axes: [{ id: 'a' }, { id: 'b' }, { id: 'c' }], curves: [{ id: 'x', values: [1, 2, 3] }, { id: 'y', values: [4] }] };

describe('radar structure', () => {
  it('builds a radar from nothing: axes, then curves of zeros', () => {
    let d: RadarData = { kind: 'radar', axes: [], curves: [] };
    d = insertRadarCurve(d, 0);
    for (let i = 0; i < 3; i++) d = insertRadarAxis(d, i);
    expect(d).toEqual({ kind: 'radar', axes: [{ id: 'axis1' }, { id: 'axis2' }, { id: 'axis3' }], curves: [{ id: 'curve1', values: [0, 0, 0] }] });
    compiles(d);
  });

  it('carries each curve\'s values with the axes as they come, go and move', () => {
    expect(insertRadarAxis(R, 1, { id: 'n' }).curves.map((c) => c.values)).toEqual([[1, 0, 2, 3], [4, 0, 0, 0]]);
    expect(removeRadarAxis(R, 0).curves.map((c) => c.values)).toEqual([[2, 3], [0, 0]]);
    const moved = moveRadarAxis(R, 0, 2);
    expect(moved.axes.map((a) => a.id)).toEqual(['b', 'c', 'a']);
    expect(moved.curves[0]!.values).toEqual([2, 3, 1]);
  });

  it('moves and removes curves and sets ids, refusing one already held', () => {
    expect(moveRadarCurve(R, 0, 1).curves.map((c) => c.id)).toEqual(['y', 'x']);
    expect(removeRadarCurve(R, 0).curves.map((c) => c.id)).toEqual(['y']);
    expect(setRadarAxisId(R, 0, 'z').axes[0]).toEqual({ id: 'z' });
    expect(() => setRadarAxisId(R, 0, 'b')).toThrow(/already has id "b"/);
    expect(() => setRadarCurveId(R, 0, 'a b')).toThrow(/letters, digits/);
  });

  it('sets and drops options', () => {
    const d = setRadarOption(setRadarOption(setRadarOption(R, 'max', 10), 'graticule', 'polygon'), 'ticks', 4);
    expect(d).toMatchObject({ max: 10, graticule: 'polygon', ticks: 4 });
    expect(setRadarOption(setRadarOption(setRadarOption(d, 'max', undefined), 'graticule', undefined), 'ticks', undefined)).toEqual(R);
    expect(() => setRadarOption(R, 'ticks', 0)).toThrow(/at least 1/);
    compiles(d);
  });
});
