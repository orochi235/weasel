/** Each piece of a Divide or a Crop stands in for its own source, not the topmost one. */
import { describe, it, expect } from 'vitest';
import { pathFromD, type Path } from '@weasel-js/geom';
import type { Paint } from '@weasel-js/paint';
import type { PathPaint } from 'canvas/nodeShapes/nodePaint';
import { asNodeId, type NodeId } from 'core/scene/types';
import { IDENTITY_POSE_COMPOSITION } from 'core/scene/composeFrame';
import { createScene } from 'core/scene/scene';
import { defaultCommitAdapter } from 'interactions/actions/defaultCommitAdapter';
import { applyBooleanOp, type BooleansAdapter } from './booleans';
import { rootsTree } from 'core/adapters/testing/rootsTree';

const RED: Paint = { color: '#f00' };
const BLUE: Paint = { color: '#00f' };
const rect = (x: number, y: number, width: number, height: number): Path => ({ kind: 'rect', x, y, width, height });

interface Source { id: string; path: Path; paint?: PathPaint }

/** Sources back to front. Records the source and the paint each result was minted with. */
function harness(sources: Source[]) {
  const made: { source: string; paint: PathPaint | undefined }[] = [];
  const by = new Map(sources.map((s, i) => [s.id, { ...s, z: i }]));
  const adapter: BooleansAdapter = {
    ...rootsTree(),
    getSelection: () => sources.map((s) => s.id as NodeId),
    getWorldPath: (id) => by.get(id)?.path,
    getPaint: (id) => by.get(id)?.paint,
    compareZ: (a, b) => by.get(a)!.z - by.get(b)!.z,
    createPathNode: (_path, _op, sourceId, paint) => {
      made.push({ source: sourceId, paint });
      return { id: `r${made.length}` };
    },
    applyOps: () => {},
  };
  return { adapter, made };
}

describe('applyBooleanOp: the source each piece stands in for', () => {
  it('crop: hands createPathNode the source each piece was clipped from, never the mask', () => {
    const h = harness([
      { id: 'a', path: rect(0, 0, 10, 10) },
      { id: 'b', path: rect(0, 10, 10, 10) },
      { id: 'mask', path: rect(5, 0, 20, 20) },
    ]);
    applyBooleanOp(h.adapter, 'crop');
    expect(h.made.map((m) => m.source)).toEqual(['a', 'b']);
  });

  it('divide: hands createPathNode the topmost source covering each piece', () => {
    const h = harness([
      { id: 'a', path: rect(0, 0, 10, 10) },
      { id: 'b', path: rect(5, 5, 10, 10) },
    ]);
    applyBooleanOp(h.adapter, 'divide');
    expect(h.made.map((m) => m.source).sort()).toEqual(['a', 'b', 'b']);
  });

  it('crop: a piece of a stroked line wears the line\'s paint, not the mask\'s', () => {
    const h = harness([
      { id: 'line', path: pathFromD('M-20 50 L120 50'), paint: { fill: null, stroke: { paint: RED, width: 10 } } },
      { id: 'mask', path: rect(0, 0, 100, 100), paint: { fill: { paint: BLUE } } },
    ]);
    applyBooleanOp(h.adapter, 'crop', { strokes: 'unfilled' });
    expect(h.made).toEqual([{ source: 'line', paint: { fill: { paint: RED } } }]);
  });
});

describe('applyBooleanOp: where pieces from several parents land', () => {
  function nested() {
    const scene = createScene<{ path?: Path }, 'default', Path>({ composition: IDENTITY_POSE_COMPOSITION, systemLayers: [{ id: 'default' }] });
    const add = (id: string, path: Path, parent?: string) => scene.add({
      id: asNodeId(id), kind: 'mark', layer: 'default', pose: path, data: { path },
      ...(parent ? { parent: asNodeId(parent) } : {}),
    });
    scene.add({ id: asNodeId('g'), kind: 'group', layer: 'default', pose: rect(0, 0, 0, 0), data: {} });
    add('below', rect(300, 0, 10, 10), 'g');
    add('a', rect(0, 0, 10, 10), 'g');
    add('above', rect(400, 0, 10, 10), 'g');
    add('other', rect(500, 0, 10, 10));
    add('mask', rect(5, 0, 20, 20));
    let n = 0;
    const adapter: BooleansAdapter = {
      ...defaultCommitAdapter(scene),
      getWorldPath: (id) => scene.get(asNodeId(id))?.data.path,
      compareZ: (x, y) => {
        const order = [...scene.renderOrder()];
        return order.indexOf(asNodeId(x)) - order.indexOf(asNodeId(y));
      },
      createPathNode: (path, _op, sourceId) => {
        const parent = scene.get(asNodeId(sourceId))?.parent;
        return { id: `r${n++}`, kind: 'mark', layer: 'default', pose: path, data: { path }, parent } as { id: string };
      },
      applyOps: (ops, label) => { scene.applyBatch(ops, label ?? 'Booleans', adapter); },
    };
    scene.setSelection([asNodeId('a'), asNodeId('mask')]);
    return { scene, adapter };
  }

  it('crop: a piece takes its own source\'s parent and slot', () => {
    const { scene, adapter } = nested();
    const result = applyBooleanOp(adapter, 'crop');
    expect(result).toEqual({ kind: 'applied', resultIds: ['r0'] });
    expect([...scene.childrenOf(asNodeId('g'))]).toEqual(['below', 'r0', 'above']);
    expect([...scene.roots]).toEqual(['g', 'other']);
  });

  it('crop: undo puts every source back where it was', () => {
    const { scene, adapter } = nested();
    applyBooleanOp(adapter, 'crop');
    scene.undo();
    expect([...scene.childrenOf(asNodeId('g'))]).toEqual(['below', 'a', 'above']);
    expect([...scene.roots]).toEqual(['g', 'other', 'mask']);
  });
});
