import { describe, expect, it } from 'vitest';
import { axisMarks, axisRoom } from './axes';
import { bandScale } from './scales/band';
import { linearScale } from './scales/linear';
import { PLOT_THEME } from './theme';

const measure = (text: string) => ({ width: text.length * 10, height: 20 });
const theme = { ...PLOT_THEME, axis: '#axis', grid: '#grid', text: '#text' };

describe('axisMarks', () => {
  it('a left value axis: rule, ticks out to the left, right-aligned labels, grid across', () => {
    const scale = linearScale({ domain: [0, 100], range: [200, 0] });
    const marks = axisMarks({ scale, side: 'left', at: 50, gridTo: 300, theme, measure, key: 'y' });
    const byKey = new Map(marks.map((m) => [m.key, m]));
    expect(byKey.get('y:rule')!.pose).toEqual({ x: 50, y: 0, width: 0, height: 200 });
    expect(byKey.get('y:tick:0')!.pose).toEqual({ x: 45, y: 200, width: 5, height: 0 });
    const top = byKey.get('y:label:5')!;
    expect(top.data.text).toBe('100');
    expect(top.data.style?.align).toBe('right');
    expect(top.pose.x + top.pose.width).toBe(41);
    expect(byKey.get('y:grid:1')!.pose).toEqual({ x: 50, y: 160, width: 250, height: 0 });
    expect(byKey.get('y:grid:1')!.data.stroke?.paint.color).toBe('#grid');
    // Grid lines come first, so the rule and ticks draw over them.
    expect(marks[0]!.key).toBe('y:grid:0');
  });

  it('a bottom band axis: a label under each band center, and a title under the labels', () => {
    const scale = bandScale({ domain: ['a', 'b'], range: [0, 200], paddingInner: 0, paddingOuter: 0 });
    const marks = axisMarks({ scale, side: 'bottom', at: 100, title: 'Kind', theme, measure });
    const label = marks.find((m) => m.key === 'axis:bottom:label:1')!;
    expect(label.pose).toEqual({ x: 145, y: 109, width: 10, height: 20 });
    const title = marks.find((m) => m.key === 'axis:bottom:title')!;
    expect(title.pose.y).toBe(133);
    expect(title.data.text).toBe('Kind');
  });

  it('a vertical title turns', () => {
    const scale = linearScale({ domain: [0, 1], range: [100, 0] });
    const title = axisMarks({ scale, side: 'left', at: 60, title: 'Rate', theme, measure }).find((m) => m.key === 'axis:left:title')!;
    expect(title.pose.rotation).toBeCloseTo(-Math.PI / 2);
  });
});

describe('axisRoom', () => {
  it('holds the ticks, the widest label and the title', () => {
    const scale = linearScale({ domain: [0, 1000], range: [0, 1] });
    expect(axisRoom({ scale, side: 'left', at: 0, theme, measure })).toBe(5 + 4 + 40);
    expect(axisRoom({ scale, side: 'bottom', at: 0, title: 'x', theme, measure })).toBe(5 + 4 + 20 + 24);
  });
});
