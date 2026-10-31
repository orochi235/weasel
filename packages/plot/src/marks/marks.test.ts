import { boundsOfPath } from '@weasel-js/geom';
import { describe, expect, it } from 'vitest';
import { barMark, pointMark, spanMark } from './boxes';
import { arcMark, areaMark, lineMark, ribbonMark, ruleMark } from './paths';
import { textMark } from './text';

const measure = (text: string) => ({ width: text.length * 10, height: 20 });
const font = { fontFamily: 'sans-serif', fontSize: 12 };

describe('box marks', () => {
  it('bar: spans from its baseline to its end, either way round, keeping its datum', () => {
    const up = barMark({ key: 'b', x: 10, width: 20, from: 100, to: 40, color: '#f00', datum: { value: 6 } });
    expect(up.pose).toEqual({ x: 10, y: 40, width: 20, height: 60 });
    expect(up.data).toMatchObject({ plotMark: { kind: 'bar', datum: { value: 6 } }, shape: 'rect', fill: { paint: { color: '#f00' } } });
    const down = barMark({ key: 'b', x: 10, width: 20, from: 100, to: 130, color: '#f00' });
    expect(down.pose).toEqual({ x: 10, y: 100, width: 20, height: 30 });
    expect(down.data.plotMark.datum).toBeUndefined();
  });

  it('bar: runs along x when horizontal', () => {
    expect(barMark({ key: 'b', x: 5, width: 10, from: 0, to: 50, color: '#f00', orient: 'horizontal' }).pose)
      .toEqual({ x: 0, y: 5, width: 50, height: 10 });
  });

  it('span: covers x0..x1 in its row', () => {
    const s = spanMark({ key: 's', x0: 80, x1: 20, y: 5, height: 10, color: '#0f0', opacity: 0.5, datum: { task: 'a' } });
    expect(s.pose).toEqual({ x: 20, y: 5, width: 60, height: 10 });
    expect(s.data).toMatchObject({ plotMark: { kind: 'span', datum: { task: 'a' } }, fill: { paint: { color: '#0f0', opacity: 0.5 } } });
  });

  it('point: an ellipse centered on its point', () => {
    const p = pointMark({ key: 'p', x: 50, y: 60, radius: 4, color: '#00f', datum: { index: 2 } });
    expect(p.pose).toEqual({ x: 46, y: 56, width: 8, height: 8 });
    expect(p.data).toMatchObject({ plotMark: { kind: 'point', datum: { index: 2 } }, shape: 'ellipse' });
  });
});

describe('path marks', () => {
  it('line: a stroked path through its points, its pose the path box', () => {
    const l = lineMark({ key: 'l', points: [{ x: 0, y: 10 }, { x: 50, y: 0 }, { x: 100, y: 30 }], color: '#f00' });
    expect(l.pose).toEqual({ x: 0, y: 0, width: 100, height: 30 });
    expect(l.data.stroke).toMatchObject({ paint: { color: '#f00' }, width: 2 });
    expect(l.data.fill).toBeUndefined();
    expect(boundsOfPath(l.data.path!)).toMatchObject(l.pose);
    expect(() => lineMark({ key: 'l', points: [], color: '#f00' })).toThrow(/no points/);
  });

  it('rule: one segment, zero thick along its run', () => {
    const r = ruleMark({ key: 'r', from: { x: 0, y: 20 }, to: { x: 80, y: 20 }, color: '#888' });
    expect(r.pose).toEqual({ x: 0, y: 20, width: 80, height: 0 });
    expect(r.data).toMatchObject({ plotMark: { kind: 'rule' }, stroke: { width: 1 } });
  });

  it('area: filled down to its baseline', () => {
    const a = areaMark({ key: 'a', top: [{ x: 0, y: 10 }, { x: 40, y: 0 }], baseline: 50, color: '#0f0' });
    expect(a.pose).toEqual({ x: 0, y: 0, width: 40, height: 50 });
    expect(a.data.fill).toEqual({ paint: { color: '#0f0', opacity: 0.35 } });
  });

  it('arc: a quarter pie slice from twelve o\'clock to three', () => {
    const a = arcMark({ key: 'a', center: { x: 100, y: 100 }, innerRadius: 0, outerRadius: 50, startAngle: 0, endAngle: Math.PI / 2, color: '#f0f', datum: { label: 'x' } });
    expect(a.pose.x).toBeCloseTo(100);
    expect(a.pose.y).toBeCloseTo(50);
    expect(a.pose.width).toBeCloseTo(50);
    expect(a.pose.height).toBeCloseTo(50);
    expect(a.data.plotMark).toEqual({ kind: 'arc', datum: { label: 'x' } });
  });

  it('arc: a whole ring reaches all round', () => {
    const a = arcMark({ key: 'a', center: { x: 0, y: 0 }, innerRadius: 20, outerRadius: 40, startAngle: 0, endAngle: 2 * Math.PI, color: '#f0f' });
    expect(a.pose.x).toBeCloseTo(-40);
    expect(a.pose.width).toBeCloseTo(80);
    expect(a.pose.height).toBeCloseTo(80);
  });

  it('ribbon: spans both ends', () => {
    const r = ribbonMark({ key: 'r', from: { x: 0, y0: 0, y1: 20 }, to: { x: 100, y0: 50, y1: 60 }, color: '#abc', datum: { value: 3 } });
    expect(r.pose).toEqual({ x: 0, y: 0, width: 100, height: 60 });
    expect(r.data.plotMark).toEqual({ kind: 'ribbon', datum: { value: 3 } });
  });
});

describe('textMark', () => {
  it('places its measured box by its anchor', () => {
    const middle = textMark({ key: 't', text: 'abcd', x: 100, y: 50, font, color: '#fff', measure });
    expect(middle.pose).toEqual({ x: 80, y: 40, width: 40, height: 20 });
    expect(middle.data).toMatchObject({ text: 'abcd', style: { align: 'center', fontSize: 12 }, fill: { paint: { color: '#fff' } } });
    const end = textMark({ key: 't', text: 'abcd', x: 100, y: 50, anchor: 'end', baseline: 'top', font, color: '#fff', measure });
    expect(end.pose).toEqual({ x: 60, y: 50, width: 40, height: 20 });
    expect(end.data.style?.align).toBe('right');
  });

  it('turns a quarter turn and runs up from its anchor when vertical', () => {
    const t = textMark({ key: 't', text: 'abcd', x: 10, y: 100, anchor: 'start', baseline: 'top', font, color: '#fff', measure, vertical: true });
    // On screen it spans x 10..30 and y 60..100.
    expect(t.pose.x + t.pose.width / 2).toBe(20);
    expect(t.pose.y + t.pose.height / 2).toBe(80);
    expect(t.pose.rotation).toBeCloseTo(-Math.PI / 2);
  });
});
