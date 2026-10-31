import { describe, expect, it } from 'vitest';
import { PLOT_THEME, seriesColor } from '../theme';
import { compileRadar, radarDomain } from './compile';
import { radarValueAt, setRadarAxisLabel, setRadarCurveLabel, setRadarValue } from './edit';
import { radarEditor } from './editor';
import type { RadarData } from './types';

const measure = (text: string) => ({ width: text.length * 7, height: 14 });
const SIZE = { width: 600, height: 500 };

const GRADES: RadarData = {
  kind: 'radar',
  title: 'Grades',
  axes: [{ id: 'm', label: 'Math' }, { id: 's', label: 'Science' }, { id: 'e' }, { id: 'h', label: 'History' }],
  curves: [
    { id: 'a', label: 'Alice', values: [80, 90, 70, 60] },
    { id: 'b', values: [50, 40, 100, 75] },
  ],
  max: 100,
};

const byKey = (data: RadarData, size = SIZE) => {
  const { marks, layout } = compileRadar(data, size, PLOT_THEME, measure);
  return { layout, marks, get: (key: string) => marks.find((m) => m.key === key) };
};

const centerOf = (pose: { x: number; y: number; width: number; height: number }) => ({ x: pose.x + pose.width / 2, y: pose.y + pose.height / 2 });

describe('compileRadar', () => {
  it('puts a point on each value along its axis, keeping curve and axis', () => {
    const { layout, get } = byKey(GRADES);
    const point = get('point:0:1')!;
    const at = layout.scale.point(1, 90);
    expect(centerOf(point.pose).x).toBeCloseTo(at.x);
    expect(centerOf(point.pose).y).toBeCloseTo(at.y);
    expect(point.data.plotMark).toEqual({ kind: 'point', datum: { curve: 0, axis: 1 } });
    expect(point.data.fill?.paint.color).toBe(seriesColor(PLOT_THEME, 0));
  });

  it('fills each curve as a closed polygon in its series color', () => {
    const { get } = byKey(GRADES);
    const area = get('curve:1')!;
    expect(area.data.plotMark).toEqual({ kind: 'area', datum: { curve: 1 } });
    expect(area.data.fill?.paint.color).toBe(seriesColor(PLOT_THEME, 1));
    expect(get('curve:1:outline')!.data.stroke?.paint.color).toBe(seriesColor(PLOT_THEME, 1));
  });

  it('draws a ring per tick and a spoke per axis, and labels each axis beyond the rim', () => {
    const { layout, marks, get } = byKey({ ...GRADES, ticks: 4 });
    expect(marks.filter((m) => m.key.startsWith('grid:ring:'))).toHaveLength(4);
    expect(get('grid:ring:4')!.pose.width).toBeCloseTo(2 * layout.scale.radius[1], 0);
    expect(marks.filter((m) => m.key.startsWith('grid:spoke:'))).toHaveLength(4);
    const label = get('axis:0:label')!;
    expect(label.data.text).toBe('Math');
    expect(label.data.plotMark.datum).toEqual({ edit: 'axis', axis: 0 });
    expect(label.pose.y + label.pose.height).toBeLessThan(layout.scale.center.y - layout.scale.radius[1]);
    expect(get('axis:2:label')!.data.text).toBe('e');
  });

  it('draws polygon rings through the spokes when asked', () => {
    const { layout, get } = byKey({ ...GRADES, graticule: 'polygon' });
    const ring = get('grid:ring:5')!;
    expect(ring.pose.y).toBeCloseTo(layout.scale.point(0, 100).y);
    expect(ring.pose.height).toBeCloseTo(2 * layout.scale.radius[1]);
  });

  it('keeps a legend at its right edge unless told not to', () => {
    const { layout, get } = byKey(GRADES);
    const label = get('legend:1:label')!;
    expect(label.data.text).toBe('b');
    expect(label.data.plotMark.datum).toEqual({ edit: 'curve', curve: 1 });
    expect(label.pose.x).toBeGreaterThan(layout.scale.center.x + layout.scale.radius[1]);
    expect(byKey({ ...GRADES, showLegend: false }).get('legend:0:label')).toBeUndefined();
  });

  it('spans its own ends, else zero to the largest value', () => {
    expect(radarDomain(GRADES)).toEqual([0, 100]);
    expect(radarDomain({ ...GRADES, max: undefined })).toEqual([0, 100]);
    expect(radarDomain({ ...GRADES, max: undefined, curves: [{ id: 'c', values: [3, 7] }] })).toEqual([0, 7]);
    expect(radarDomain({ kind: 'radar', axes: [], curves: [], min: 2 })).toEqual([2, 3]);
  });

  it('does not throw on an empty chart or a tiny box', () => {
    expect(byKey({ kind: 'radar', axes: [], curves: [] }).marks.length).toBeGreaterThan(0);
    expect(() => byKey(GRADES, { width: 5, height: 5 })).not.toThrow();
  });

  it('keeps every key unique', () => {
    const keys = byKey(GRADES).marks.map((m) => m.key);
    expect(new Set(keys).size).toBe(keys.length);
  });
});

describe('radar edits', () => {
  it('setRadarValue replaces one value and nothing else', () => {
    const next = setRadarValue(GRADES, 1, 2, 55);
    expect(next.curves[1]!.values).toEqual([50, 40, 55, 75]);
    expect(next.curves[0]).toBe(GRADES.curves[0]);
    expect(setRadarValue(GRADES, 0, 0, 80)).toBe(GRADES);
    expect(() => setRadarValue(GRADES, 0, 9, 1)).toThrow(/axis 9/);
    expect(() => setRadarValue(GRADES, 5, 0, 1)).toThrow(/curve 5/);
  });

  it('relabels an axis or a curve, an empty label falling back to its id', () => {
    expect(setRadarAxisLabel(GRADES, 2, 'English').axes[2]).toEqual({ id: 'e', label: 'English' });
    expect(setRadarAxisLabel(GRADES, 0, ' ').axes[0]).toEqual({ id: 'm' });
    expect(setRadarAxisLabel(GRADES, 0, 'Math')).toBe(GRADES);
    expect(setRadarCurveLabel(GRADES, 1, 'Bob').curves[1]).toEqual({ id: 'b', label: 'Bob', values: [50, 40, 100, 75] });
    expect(() => setRadarAxisLabel(GRADES, 7, 'x')).toThrow(/no item 7/);
  });

  it('radarValueAt reads along the axis, rounded to a tenth of a tick', () => {
    const { layout } = byKey(GRADES);
    const at = layout.scale.point(3, 42.3);
    expect(radarValueAt(layout, 3, { x: at.x, y: at.y + 30 })).toBe(42);
  });

  it('the editor puts a move handle on each point, and a drag proposes the value under the pointer', () => {
    const { layout, get } = byKey(GRADES);
    const point = get('point:1:1')!;
    const handle = radarEditor.handle(GRADES, { trait: point.data.plotMark, pose: point.pose }) as { at: { x: number; y: number }; cursor: string };
    expect(handle.cursor).toBe('move');
    expect(handle.at.x).toBeCloseTo(centerOf(point.pose).x);
    expect(radarEditor.handle(GRADES, { trait: get('curve:1')!.data.plotMark, pose: get('curve:1')!.pose })).toBeNull();
    const drag = radarEditor.drag(GRADES, point.data.plotMark, SIZE, PLOT_THEME, measure)!;
    expect(drag(layout.scale.point(1, 64.3)).curves[1]!.values).toEqual([50, 64, 100, 75]);
  });

  it('edits the title, axis labels and curve labels in place', () => {
    expect(radarEditor.text!(GRADES, { edit: 'title' }, 'Marks').title).toBe('Marks');
    expect(radarEditor.text!(GRADES, { edit: 'axis', axis: 1 }, 'Physics').axes[1]!.label).toBe('Physics');
    expect(radarEditor.text!(GRADES, { edit: 'curve', curve: 0 }, 'Al').curves[0]!.label).toBe('Al');
    expect(radarEditor.text!(GRADES, { edit: 'other' }, 'x')).toBe(GRADES);
  });
});
