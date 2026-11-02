import { describe, expect, it } from 'vitest';
import {
  boundsOfPath, pathFromD, solid, type Path, type PolygonPath, type Stroke,
} from '@weasel-js/core';
import { svgLeafFromKit } from './fromKit';
import { serializeSvg } from './serialize';
import type { SvgPaint, SvgPathNode } from './types';

const INK = solid('#000000');
const RED = solid('#ff0000');
const poseOf = (path: Path) => {
  const b = boundsOfPath(path);
  return { x: b.x, y: b.y, width: b.width, height: b.height };
};
/** Every `<path>` the leaf writes, outside `<defs>`. */
function paths(path: Path, stroke: Stroke, fill: Stroke['paint'] | null = null, pose = poseOf(path)): string[] {
  const node = svgLeafFromKit({ path, stroke, fill: fill ? { paint: fill } : null }, pose)!;
  return serializeSvg([node]).replace(/<defs>[\s\S]*<\/defs>/, '').match(/<path [^>]*>/g) ?? [];
}
const dOf = (p: string) => /\bd="([^"]*)"/.exec(p)![1];
const stroked = (ps: string[]) => ps.filter((p) => !p.includes('stroke="none"'));
const endOf = (p: string): [number, number] => {
  const nums = dOf(p).match(/-?[\d.]+(?:e-?\d+)?/g)!.map(Number);
  return [nums[nums.length - 2], nums[nums.length - 1]];
};

describe('svg export bakes a stroke trim', () => {
  it('writes the visible span with its end marker and no pathLength', () => {
    const [p] = stroked(paths(pathFromD('M0 0 L100 0'), { paint: INK, width: 2, markerEnd: 'arrow', trim: { end: 0.5 } }));
    expect(dOf(p)).toBe('M0 0L50 0');
    expect(p).toContain('marker-end=');
    expect(p).not.toContain('pathLength');
  });

  it('fill keeps the whole outline under a trim', () => {
    const square = pathFromD('M0 0 L100 0 L100 100 L0 100 Z');
    const out = paths(square, { paint: INK, width: 2, trim: { end: 0.5 } }, RED);
    expect(out).toHaveLength(2);
    const [fill, stroke] = out;
    expect(fill).toContain('fill="#ff0000"');
    expect(fill).toContain('stroke="none"');
    expect(dOf(fill)).toBe('M0 0L100 0L100 100L0 100Z');
    expect(stroke).toContain('fill="none"');
    expect(dOf(stroke)).toBe('M0 0L100 0L100 100');
  });

  it("starts a dash at the run's phase", () => {
    const [p] = stroked(paths(pathFromD('M0 0 L100 0'), { paint: INK, width: 2, dash: [10, 10], trim: { start: 0.15 } }));
    expect(dOf(p)).toBe('M15 0L100 0');
    expect(p).toContain('stroke-dasharray="10 10"');
    expect(p).toContain('stroke-dashoffset="15"');
  });

  it('writes a run that starts mid-pattern apart from the runs after it', () => {
    const two = pathFromD('M0 0 L10 0 M20 0 L30 0');
    const out = stroked(paths(two, { paint: INK, width: 1, dash: [2, 2], trim: { start: 0.25 } }));
    expect(out.map(dOf)).toEqual(['M5 0L10 0', 'M20 0L30 0']);
    expect(out[0]).toContain('stroke-dashoffset="5"');
    expect(out[1]).not.toContain('stroke-dashoffset');
  });

  it('writes no dash offset for an undashed trim, nor for one starting at 0', () => {
    expect(stroked(paths(pathFromD('M0 0 L100 0'), { paint: INK, width: 1, trim: { start: 0.5 } }))[0]).not.toContain('dashoffset');
    expect(stroked(paths(pathFromD('M0 0 L100 0'), { paint: INK, width: 1, dash: [3, 3], trim: { end: 0.5 } }))[0])
      .not.toContain('dashoffset');
  });

  it('gives a run cut from a closed subpath no end markers', () => {
    const square = pathFromD('M0 0 L100 0 L100 100 L0 100 Z');
    const [p] = stroked(paths(square, { paint: INK, width: 2, markerStart: 'dot', markerEnd: 'arrow', trim: { end: 0.5 } }));
    expect(dOf(p)).toBe('M0 0L100 0L100 100');
    expect(p).not.toMatch(/marker-(start|end)=/);
  });

  it('writes nothing of the stroke for an empty window, and keeps the fill', () => {
    const square = pathFromD('M0 0 L100 0 L100 100 L0 100 Z');
    const out = paths(square, { paint: INK, width: 2, trim: { start: 0.5, end: 0.5 } }, RED);
    expect(out).toHaveLength(1);
    expect(out[0]).toContain('stroke="none"');
    expect(dOf(out[0])).toBe('M0 0L100 0L100 100L0 100Z');
  });

  it('writes nothing at all for an empty window on an unfilled node', () => {
    expect(paths(pathFromD('M0 0 L100 0'), { paint: INK, width: 2, trim: { start: 0.5, end: 0.5 } })).toEqual([]);
  });

  it('defines no marker for a stroke an empty window leaves undrawn', () => {
    const stroke: Stroke = { paint: INK, width: 2, markerEnd: 'arrow', trim: { start: 0.5, end: 0.5 } };
    const node = svgLeafFromKit({ path: pathFromD('M0 0 L100 0'), stroke, fill: { paint: RED } }, poseOf(pathFromD('M0 0 L100 0')))!;
    expect(serializeSvg([node])).not.toContain('<marker');
  });

  it('measures an inner-aligned rect on its authored edge, as the canvas does', () => {
    const rect: Path = { kind: 'rect', x: 0, y: 0, width: 100, height: 50 };
    const [p] = stroked(paths(rect, { paint: INK, width: 10, align: 'inner', trim: { end: { length: 120 } } }));
    expect(dOf(p)).toBe('M0 0L100 0L100 20');
  });

  it('counts anchors in authored numbering on a cornered path', () => {
    const path = { ...(pathFromD('M0 0 L100 0 L100 100') as PolygonPath), corners: [null, { shape: 'round', radius: 20 }, null] } as PolygonPath;
    const [p] = stroked(paths(path, { paint: INK, width: 2, trim: { end: { anchor: 1 } } }));
    const [x, y] = endOf(p);
    expect(x).toBeCloseTo(80 + 20 * Math.SQRT1_2, 1);
    expect(y).toBeCloseTo(20 - 20 * Math.SQRT1_2, 1);
  });

  it('measures before the pose frame, as the ribbon does', () => {
    const path = pathFromD('M0 0 L100 0 L100 50');
    const pose = { ...poseOf(path), transform: [2, 0, 0, 1] as const };
    // 125 local units ends halfway down the vertical edge; the stretch doubles x about the box center.
    const [p] = stroked(paths(path, { paint: INK, width: 2, trim: { end: { length: 125 } } }, null, pose));
    const [x, y] = endOf(p);
    expect(x).toBeCloseTo(150, 3);
    expect(y).toBeCloseTo(25, 3);
  });

  it("cuts a variable-width stroke's outline, leaving its path whole", () => {
    const line = pathFromD('M0 0 L100 0');
    const out = paths(line, { paint: INK, width: 4, vertexWidths: [2, 8], trim: { end: 0.5 } });
    const outline = out.find((p) => p.includes('stroke-outline'))!;
    const xs = dOf(outline).match(/-?[\d.]+/g)!.map(Number).filter((_v, i) => i % 2 === 0);
    expect(Math.max(...xs)).toBeCloseTo(50, 0);
    expect(dOf(out[0])).toBe('M0 0L100 0');
  });

  it("maps a box-relative stroke gradient onto the node's whole box, not the visible run", () => {
    const ramp = (to: { x: number; y: number }): SvgPaint => ({
      kind: 'gradient', paint: {
        kind: 'linear-gradient', units: 'bounds', from: { x: 0, y: 0 }, to,
        stops: [{ offset: 0, color: '#ff0000' }, { offset: 1, color: '#0000ff' }],
      },
    });
    const write = (d: string, to: { x: number; y: number }) => {
      const node: SvgPathNode = {
        kind: 'path', path: pathFromD(d), fill: { kind: 'none' },
        stroke: { paint: ramp(to), width: 2, trim: { end: 0.3 } },
      };
      return serializeSvg([node]);
    };
    // The run M0 0L60 0 has no height; mapped onto it, SVG would paint nothing.
    const flat = write('M0 0 L100 0 L100 100', { x: 0, y: 1 });
    expect(flat).toContain('gradientUnits="userSpaceOnUse"');
    expect(flat).toContain('x1="0" y1="0" x2="0" y2="100"');
    // A curve's box is its extent, 75 high, wherever the window ends.
    const curve = write('M0 0 C0 100 100 100 100 0', { x: 1, y: 1 });
    expect(curve).toContain('gradientUnits="userSpaceOnUse"');
    expect(curve).toContain('x1="0" y1="0" x2="100" y2="75"');
  });
});
