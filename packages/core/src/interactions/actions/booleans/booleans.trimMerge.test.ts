import { describe, it, expect } from 'vitest';
import { boundsOfPath, pathFromD, type Path } from '@weasel-js/geom';
import type { Paint } from '@weasel-js/paint';
import type { PathPaint } from 'canvas/nodeShapes/nodePaint';
import type { NodeId } from 'core/scene/types';
import { applyBooleanOp, type BooleansAdapter } from './booleans';
import { rootsTree } from 'core/adapters/testing/rootsTree';

const RED: Paint = { color: '#f00' };
const BLUE: Paint = { color: '#00f' };
const rect = (x: number, y: number, width: number, height: number): Path => ({ kind: 'rect', x, y, width, height });

interface Source { id: string; path: Path; paint?: PathPaint }

/** Sources back to front. Records each result's source, paint, and bounds as `x..right`. */
function harness(sources: Source[]) {
  const made: { source: string; paint: PathPaint | undefined; span: string }[] = [];
  const by = new Map(sources.map((s, i) => [s.id, { ...s, z: i }]));
  const adapter: BooleansAdapter = {
    ...rootsTree(),
    getSelection: () => sources.map((s) => s.id as NodeId),
    getWorldPath: (id) => by.get(id)?.path,
    getPaint: (id) => by.get(id)?.paint,
    compareZ: (a, b) => by.get(a)!.z - by.get(b)!.z,
    createPathNode: (path, _op, sourceId, paint) => {
      const b = boundsOfPath(path);
      made.push({ source: sourceId, paint, span: `${b.x}..${b.x + b.width}` });
      return { id: `r${made.length}` };
    },
    applyOps: () => {},
  };
  return { adapter, made };
}

describe('applyBooleanOp: trim and merge', () => {
  it('trim: each source keeps the part of it left showing', () => {
    const h = harness([
      { id: 'a', path: rect(0, 0, 10, 10), paint: { fill: { paint: RED } } },
      { id: 'b', path: rect(5, 0, 10, 10), paint: { fill: { paint: RED } } },
    ]);
    expect(applyBooleanOp(h.adapter, 'trim').kind).toBe('applied');
    expect(h.made.map((m) => [m.source, m.span])).toEqual([['a', '0..5'], ['b', '5..15']]);
  });

  it('merge: unites the sources that wear one fill, and trims the rest', () => {
    const h = harness([
      { id: 'a', path: rect(0, 0, 10, 10), paint: { fill: { paint: { color: '#f00' } } } },
      { id: 'b', path: rect(20, 0, 10, 10), paint: { fill: { paint: BLUE } } },
      { id: 'c', path: rect(5, 0, 10, 10), paint: { fill: { paint: { color: '#f00' } } } },
    ]);
    expect(applyBooleanOp(h.adapter, 'merge').kind).toBe('applied');
    expect(h.made.map((m) => [m.source, m.span])).toEqual([['b', '20..30'], ['c', '0..15']]);
  });

  it('merge: an adapter that reports no paint gets a trim', () => {
    const h = harness([
      { id: 'a', path: rect(0, 0, 10, 10) },
      { id: 'b', path: rect(5, 0, 10, 10) },
    ]);
    applyBooleanOp(h.adapter, 'merge');
    expect(h.made.map((m) => m.span)).toEqual(['0..5', '5..15']);
  });

  it('merge: a stroke counted into two lines unites them by the stroke\'s paint', () => {
    const stroke = { paint: RED, width: 10 };
    const h = harness([
      { id: 'h', path: pathFromD('M0 50 L100 50'), paint: { fill: null, stroke } },
      { id: 'v', path: pathFromD('M50 0 L50 100'), paint: { fill: null, stroke } },
    ]);
    applyBooleanOp(h.adapter, 'merge', { strokes: 'unfilled' });
    expect(h.made.map((m) => [m.source, m.paint])).toEqual([['v', { fill: { paint: RED } }]]);
  });
});
