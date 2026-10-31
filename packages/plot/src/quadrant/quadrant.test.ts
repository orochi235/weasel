import { describe, expect, it } from 'vitest';
import type { PlotHandle } from '../editing/editors';
import { PLOT_THEME, seriesColor } from '../theme';
import { compileQuadrant, quadrantAt, quadrantValueAt } from './compile';
import { setQuadrantAxisLabel, setQuadrantLabel, setQuadrantPoint, setQuadrantPointName } from './edit';
import { quadrantEditor } from './editor';
import type { QuadrantData } from './types';

const measure = (text: string) => ({ width: text.length * 7, height: 14 });
const SIZE = { width: 500, height: 500 };

const REACH: QuadrantData = {
  kind: 'quadrant',
  title: 'Reach and engagement',
  x: { low: 'Low Reach', high: 'High Reach' },
  y: { low: 'Low Engagement' },
  quadrants: ['Expand', 'Promote', 'Re-evaluate', 'Improve'],
  points: [
    { name: 'Campaign A', x: 0.3, y: 0.6 },
    { name: 'Campaign B', x: 0.45, y: 0.23, className: 'big', style: { color: '#ff3300' } },
  ],
  classes: { big: { radius: 10, color: '#0000ff', strokeColor: '#10f0f0', strokeWidth: 5 } },
};

const byKey = (data: QuadrantData) => {
  const { marks, layout } = compileQuadrant(data, SIZE, PLOT_THEME, measure);
  return { layout, marks, get: (key: string) => marks.find((m) => m.key === key) };
};

describe('compileQuadrant', () => {
  it('fills four quadrants from the theme, numbered as Mermaid numbers them', () => {
    const { layout, get } = byKey(REACH);
    const { plot } = layout;
    const one = get('quadrant:1')!;
    expect(one.pose).toEqual({ x: plot.x + plot.width / 2, y: plot.y, width: plot.width / 2, height: plot.height / 2 });
    expect(one.data.fill?.paint.color).toBe(seriesColor(PLOT_THEME, 0));
    expect(get('quadrant:3')!.pose.x).toBe(plot.x);
    expect(get('quadrant:3')!.pose.y).toBe(plot.y + plot.height / 2);
  });

  it('centers each quadrant\'s label in it', () => {
    const { layout, get } = byKey(REACH);
    const label = get('quadrant:label:2')!;
    expect(label.data.text).toBe('Promote');
    expect(label.data.plotMark.datum).toEqual({ edit: 'quadrant', quadrant: 2 });
    const c = quadrantAt(layout, 0.25, 0.75);
    expect(label.pose.x + label.pose.width / 2).toBeCloseTo(c.x);
    expect(label.pose.y + label.pose.height / 2).toBeCloseTo(c.y);
  });

  it('labels each axis\'s ends under their halves, and a low end alone across the whole axis', () => {
    const { layout, get } = byKey(REACH);
    const { plot } = layout;
    const high = get('axis:x:high')!;
    expect(high.pose.x + high.pose.width / 2).toBeCloseTo(plot.x + 0.75 * plot.width);
    expect(high.pose.y).toBeGreaterThan(plot.y + plot.height);
    expect(high.data.plotMark.datum).toEqual({ edit: 'axis', axis: 'x', end: 'high' });
    const y = get('axis:y:low')!;
    expect(y.pose.rotation).toBeCloseTo(-Math.PI / 2);
    expect(y.pose.y + y.pose.height / 2).toBeCloseTo(plot.y + plot.height / 2);
    expect(get('axis:y:high')).toBeUndefined();
  });

  it('draws each point at its place with its name beside it, its class\'s style under its own', () => {
    const { layout, get } = byKey(REACH);
    const a = get('point:0')!;
    const at = quadrantAt(layout, 0.3, 0.6);
    expect(a.pose.x + a.pose.width / 2).toBeCloseTo(at.x);
    expect(a.pose.y + a.pose.height / 2).toBeCloseTo(at.y);
    expect(a.data.plotMark.datum).toEqual({ point: 0 });
    expect(a.data.fill?.paint.color).toBe(PLOT_THEME.text);
    expect(a.data.stroke).toBeUndefined();
    const b = get('point:1')!;
    expect(b.pose.width).toBe(20);
    expect(b.data.fill?.paint.color).toBe('#ff3300');
    expect(b.data.stroke).toEqual({ paint: { color: '#10f0f0' }, width: 5 });
    const name = get('point:label:1')!;
    expect(name.data.text).toBe('Campaign B');
    expect(name.pose.x).toBeGreaterThan(b.pose.x + b.pose.width);
    expect(name.data.plotMark.datum).toEqual({ edit: 'point', point: 1 });
  });

  it('draws an empty chart and a tiny box without throwing', () => {
    expect(() => compileQuadrant({ kind: 'quadrant', points: [] }, SIZE, PLOT_THEME, measure)).not.toThrow();
    expect(() => compileQuadrant(REACH, { width: 3, height: 3 }, PLOT_THEME, measure)).not.toThrow();
  });
});

describe('quadrant edits', () => {
  it('moves and renames a point', () => {
    const moved = setQuadrantPoint(REACH, 0, { x: 0.5, y: 0.5 });
    expect(moved.points[0]).toEqual({ name: 'Campaign A', x: 0.5, y: 0.5 });
    expect(moved.points[1]).toBe(REACH.points[1]);
    expect(setQuadrantPoint(REACH, 0, { x: 0.3, y: 0.6 })).toBe(REACH);
    expect(setQuadrantPointName(REACH, 1, 'C').points[1]!.name).toBe('C');
    expect(() => setQuadrantPoint(REACH, 5, { x: 0, y: 0 })).toThrow(/no point 5/);
  });

  it('sets and drops axis and quadrant labels', () => {
    expect(setQuadrantAxisLabel(REACH, 'y', 'high', 'Lots').y).toEqual({ low: 'Low Engagement', high: 'Lots' });
    expect(setQuadrantAxisLabel(REACH, 'y', 'low', '').y).toBeUndefined();
    expect(setQuadrantAxisLabel(REACH, 'x', 'low', 'Low Reach')).toBe(REACH);
    expect(setQuadrantLabel(REACH, 4, 'Fix').quadrants).toEqual(['Expand', 'Promote', 'Re-evaluate', 'Fix']);
    expect(setQuadrantLabel(REACH, 4, '').quadrants).toEqual(['Expand', 'Promote', 'Re-evaluate']);
    expect(setQuadrantLabel({ kind: 'quadrant', points: [], quadrants: ['a'] }, 1, '').quadrants).toBeUndefined();
    expect(() => setQuadrantLabel(REACH, 5, 'x')).toThrow(/no quadrant 5/);
  });

  it('reads the unit square under the pointer, clamped and rounded to hundredths', () => {
    const { layout } = byKey(REACH);
    expect(quadrantValueAt(layout, quadrantAt(layout, 0.123, 0.987))).toEqual({ x: 0.12, y: 0.99 });
    expect(quadrantValueAt(layout, { x: -50, y: 9999 })).toEqual({ x: 0, y: 0 });
  });

  it('the editor puts a move handle on each point, and a drag moves it under the pointer', () => {
    const { layout, get } = byKey(REACH);
    const point = get('point:0')!;
    const handle = quadrantEditor.handle(REACH, { trait: point.data.plotMark, pose: point.pose }) as PlotHandle;
    expect(handle.cursor).toBe('move');
    expect(handle.at.x).toBeCloseTo(point.pose.x + point.pose.width / 2);
    expect(quadrantEditor.handle(REACH, { trait: get('quadrant:1')!.data.plotMark, pose: get('quadrant:1')!.pose })).toBeNull();
    const drag = quadrantEditor.drag(REACH, point.data.plotMark, SIZE, PLOT_THEME, measure)!;
    expect(drag(quadrantAt(layout, 0.8, 0.1)).points[0]).toMatchObject({ x: 0.8, y: 0.1 });
  });

  it('the editor sets text typed in place', () => {
    const text = quadrantEditor.text!;
    expect(text(REACH, { edit: 'title' }, 'New').title).toBe('New');
    expect(text(REACH, { edit: 'axis', axis: 'x', end: 'low' }, 'Few').x).toEqual({ low: 'Few', high: 'High Reach' });
    expect(text(REACH, { edit: 'quadrant', quadrant: 1 }, ' Grow ').quadrants![0]).toBe('Grow');
    expect(text(REACH, { edit: 'point', point: 0 }, 'Alpha').points[0]!.name).toBe('Alpha');
    expect(text(REACH, { edit: 'point', point: 0 }, '')).toBe(REACH);
    expect(text(REACH, { edit: 'point', point: 7 }, 'x')).toBe(REACH);
  });
});
