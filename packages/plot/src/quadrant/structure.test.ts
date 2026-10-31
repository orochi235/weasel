import { describe, expect, it } from 'vitest';
import { compilePlot } from '../plotData';
import { PLOT_THEME } from '../theme';
import {
  insertQuadrantClass, insertQuadrantPoint, moveQuadrantClass, moveQuadrantPoint, quadrantClassNames, removeQuadrantClass,
  removeQuadrantPoint, renameQuadrantClass, setQuadrantClassStyle, setQuadrantPointClass, setQuadrantPointStyle,
} from './structure';
import type { QuadrantData } from './types';

const measure = (text: string) => ({ width: text.length * 7, height: 14 });
const compiles = (d: QuadrantData) => expect(compilePlot(d, { width: 600, height: 400 }, PLOT_THEME, measure).length).toBeGreaterThan(0);
const EMPTY: QuadrantData = { kind: 'quadrant', points: [] };

describe('quadrant structure', () => {
  it('builds a chart from nothing: points, a class, a style', () => {
    let d = insertQuadrantPoint(insertQuadrantPoint(EMPTY, 0), 1);
    d = insertQuadrantClass(d, 0);
    d = setQuadrantPointClass(d, 1, 'class1');
    d = setQuadrantPointStyle(d, 0, 'color', '#ff0000');
    expect(d).toEqual({
      kind: 'quadrant',
      points: [{ name: 'Point 1', x: 0.5, y: 0.5, style: { color: '#ff0000' } }, { name: 'Point 2', x: 0.5, y: 0.5, className: 'class1' }],
      classes: { class1: { radius: 8 } },
    });
    expect(setQuadrantPointStyle(d, 0, 'color', undefined).points[0]).toEqual({ name: 'Point 1', x: 0.5, y: 0.5 });
    compiles(d);
  });

  it('moves and removes points', () => {
    const d = insertQuadrantPoint(insertQuadrantPoint(EMPTY, 0, { name: 'a', x: 0, y: 0 }), 1, { name: 'b', x: 1, y: 1 });
    expect(moveQuadrantPoint(d, 0, 1).points.map((p) => p.name)).toEqual(['b', 'a']);
    expect(removeQuadrantPoint(d, 0).points.map((p) => p.name)).toEqual(['b']);
  });

  it('renames and removes a class on every point using it, and keeps classes in order', () => {
    let d: QuadrantData = { kind: 'quadrant', points: [{ name: 'p', x: 0, y: 0, className: 'hot' }], classes: { hot: { color: '#f00' }, cold: {} } };
    expect(renameQuadrantClass(d, 0, 'warm').points[0]!.className).toBe('warm');
    expect(quadrantClassNames(renameQuadrantClass(d, 0, 'warm'))).toEqual(['warm', 'cold']);
    expect(() => renameQuadrantClass(d, 0, 'cold')).toThrow(/already called "cold"/);
    expect(() => renameQuadrantClass(d, 0, 'a b')).toThrow(/letters, digits/);
    expect(removeQuadrantClass(d, 0)).toEqual({ kind: 'quadrant', points: [{ name: 'p', x: 0, y: 0 }], classes: { cold: {} } });
    expect(quadrantClassNames(moveQuadrantClass(d, 0, 1))).toEqual(['cold', 'hot']);
    d = setQuadrantClassStyle(d, 1, 'radius', 4);
    expect(d.classes!.cold).toEqual({ radius: 4 });
    expect(() => setQuadrantPointClass(d, 0, 'none')).toThrow(/no class "none"/);
    expect(removeQuadrantClass(removeQuadrantClass(d, 0), 0).classes).toBeUndefined();
    compiles(d);
  });
});
