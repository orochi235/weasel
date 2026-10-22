import { describe, it, expect } from 'vitest';
import { boundsOfPath, pathFromD, pointInPath, type Path } from '@weasel-js/geom';
import type { Paint } from '@weasel-js/paint';
import type { PathPaint } from 'canvas/nodeShapes/nodePaint';
import type { NodeId } from 'core/scene/types';
import { applyBooleanOp, type BooleansAdapter } from './booleans';
import { rootsTree } from 'core/adapters/testing/rootsTree';

const RED: Paint = { color: '#f00' };
const BLUE: Paint = { color: '#00f' };
const BOX: Path = { kind: 'rect', x: 0, y: 0, width: 100, height: 100 };
/** A horizontal line through the box's middle, overhanging both sides. */
const LINE = pathFromD('M-20 50 L120 50');

interface Source { id: string; path: Path; paint: PathPaint }

/** Sources back to front. Records each minted result's path and the paint
 *  the kit told it to wear. */
function harness(sources: Source[]) {
  const made: { path: Path; paint: PathPaint | undefined }[] = [];
  const by = new Map(sources.map((s, i) => [s.id, { ...s, z: i }]));
  const adapter: BooleansAdapter = {
    ...rootsTree(),
    getSelection: () => sources.map((s) => s.id as NodeId),
    getWorldPath: (id) => by.get(id)?.path,
    getPaint: (id) => by.get(id)?.paint,
    compareZ: (a, b) => by.get(a)!.z - by.get(b)!.z,
    createPathNode: (path, _op, _sourceId, paint) => {
      made.push({ path, paint });
      return { id: `r${made.length}` };
    },
    applyOps: () => {},
  };
  return { adapter, made };
}

const box: Source = { id: 'box', path: BOX, paint: { fill: { paint: BLUE } } };
const line: Source = { id: 'line', path: LINE, paint: { fill: null, stroke: { paint: RED, width: 10 } } };
const framed: Source = { id: 'framed', path: BOX, paint: { fill: { paint: BLUE }, stroke: { paint: RED, width: 10 } } };
const far: Source = { id: 'far', path: { kind: 'rect', x: 300, y: 0, width: 10, height: 10 }, paint: { fill: { paint: BLUE } } };

describe('applyBooleanOp on stroked operands', () => {
  it('ignores strokes unless asked: an unfilled line cuts nothing out of a box', () => {
    const h = harness([box, line]);
    expect(applyBooleanOp(h.adapter, 'subtract').kind).toBe('applied');
    expect(pointInPath(h.made[0]!.path, 50, 50)).toBe(true);
    expect(h.made[0]!.paint).toBeUndefined();
  });

  for (const strokes of ['unfilled', 'include'] as const) {
    it(`${strokes}: an unfilled line is its stroke, and cuts a slot through a box`, () => {
      const h = harness([box, line]);
      expect(applyBooleanOp(h.adapter, 'subtract', { strokes }).kind).toBe('applied');
      const cut = h.made[0]!.path;
      expect(pointInPath(cut, 50, 50)).toBe(false);
      expect(pointInPath(cut, 50, 44)).toBe(true);
      expect(pointInPath(cut, 50, 56)).toBe(true);
    });

    it(`${strokes}: a result whose topmost source was a line is filled in the line's paint, unstroked`, () => {
      const h = harness([box, line]);
      applyBooleanOp(h.adapter, 'union', { strokes });
      expect(h.made[0]!.paint).toEqual({ fill: { paint: RED } });
      expect(boundsOfPath(h.made[0]!.path)).toMatchObject({ x: -20, width: 140 });
    });
  }

  it('unfilled: reads a fill with no paint as unfilled, so the line is its stroke', () => {
    const blank: Source = { ...line, paint: { fill: {}, stroke: { paint: RED, width: 10 } } };
    const h = harness([box, blank]);
    applyBooleanOp(h.adapter, 'subtract', { strokes: 'unfilled' });
    expect(pointInPath(h.made[0]!.path, 50, 50)).toBe(false);
  });

  it('unfilled: a filled operand gives its fill alone, and the result\'s paint is left to the adapter', () => {
    const h = harness([far, framed]);
    applyBooleanOp(h.adapter, 'union', { strokes: 'unfilled' });
    expect(pointInPath(h.made[0]!.path, -3, 50)).toBe(false);
    expect(h.made[0]!.paint).toBeUndefined();
  });

  it('include: a filled operand gives its fill and its stroke, and the result keeps the fill without the stroke', () => {
    const h = harness([far, framed]);
    applyBooleanOp(h.adapter, 'union', { strokes: 'include' });
    expect(pointInPath(h.made[0]!.path, -3, 50)).toBe(true);
    expect(pointInPath(h.made[0]!.path, 50, 50)).toBe(true);
    expect(h.made[0]!.paint).toEqual({ fill: { paint: BLUE } });
  });

  it('include: a stroke folded in below the topmost source leaves the result\'s paint to the adapter', () => {
    const h = harness([framed, { ...far, path: { kind: 'rect', x: 90, y: 40, width: 40, height: 20 } }]);
    applyBooleanOp(h.adapter, 'union', { strokes: 'include' });
    expect(pointInPath(h.made[0]!.path, -3, 50)).toBe(true);
    expect(h.made[0]!.paint).toBeUndefined();
  });

  it('resolves a { px } stroke width against the scale it is given', () => {
    const px: Source = { ...line, paint: { fill: null, stroke: { paint: RED, width: { px: 10 } } } };
    const h = harness([box, px]);
    applyBooleanOp(h.adapter, 'intersect', { strokes: 'include', scale: 2 });
    expect(boundsOfPath(h.made[0]!.path).height).toBeCloseTo(5);
  });

  it('reads an operand with no paint to report as its path', () => {
    const h = harness([box, line]);
    h.adapter.getPaint = () => undefined;
    applyBooleanOp(h.adapter, 'subtract', { strokes: 'include' });
    expect(pointInPath(h.made[0]!.path, 50, 50)).toBe(true);
  });
});
