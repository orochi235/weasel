/**
 * Create Outlines against a real scene, through a stub outline: the scene surgery (slot, undo,
 * selection) is the part a stub adapter would let slide. Text's glyphs through a real face are
 * text-tools' `textOutline.createOutlines.test.ts`.
 */
import { describe, it, expect } from 'vitest';
import { boundsOfPath, rectPath, type Path, type Rect } from '@weasel-js/geom';
import {
  asNodeId, createScene, defaultCommitAdapter, NodeOutlineError, type NodeId, type NodeOutline, type PaintedPath,
} from '@weasel-js/core';
import { applyCreateOutlines, type CreateOutlinesAdapter } from './createOutlines';

const RED = { kind: 'solid', color: '#c00' } as const;
const BLUE = { kind: 'solid', color: '#00c' } as const;
const STROKE = { width: 3, paint: { kind: 'solid', color: '#000' } } as const;

/** A node kind whose outline is the parts its data lists, or that cannot be built at all. */
interface Data {
  gem?: readonly PaintedPath[] | 'broken';
  path?: Path;
  fill?: unknown;
  stroke?: unknown;
}
type Pose = { x: number; y: number; width: number; height: number };

const ONE: Data = { gem: [{ path: rectPath(0, 0, 40, 20), fill: { paint: RED }, stroke: STROKE }] };
const TWO_PAINT: Data = {
  gem: [{ path: rectPath(0, 0, 10, 10), fill: { paint: RED } }, { path: rectPath(20, 0, 10, 10), fill: { paint: BLUE } }],
};
const BLANK: Data = { gem: [] };
const RECT: Data = { path: { kind: 'rect', x: 0, y: 0, width: 10, height: 10 } };

function outlineOf(gem: NonNullable<Data['gem']>): NodeOutline {
  const parts = (): readonly PaintedPath[] => {
    if (gem === 'broken') throw new NodeOutlineError('no geometry', { summary: 'The gem is uncut', pending: false });
    return gem;
  };
  return { stroked: false, path: () => parts()[0]?.path ?? rectPath(0, 0, 0, 0), parts, load: () => Promise.resolve() };
}

function setup({ containers = true }: { containers?: boolean } = {}) {
  const scene = createScene<Data, 'default', Pose>({ systemLayers: [{ id: 'default' }] });
  let nextId = 0;
  const add = (id: string, data: Data, pose: Pose = { x: 0, y: 0, width: 40, height: 20 }) =>
    scene.add({ id: asNodeId(id), kind: 'mark', layer: 'default', pose, data });
  const adapter: CreateOutlinesAdapter = {
    ...defaultCommitAdapter(scene),
    getSelection: () => [...scene.getSelection()],
    setSelection: (ids) => { scene.setSelection(ids.map(asNodeId)); },
    getOutline: (id) => {
      const n = scene.get(asNodeId(id));
      return n?.kind === 'mark' && n.data.gem !== undefined ? outlineOf(n.data.gem) : undefined;
    },
    createPathNode: (path, _sourceId, { fill, stroke, parent }) => {
      const b = boundsOfPath(path);
      return {
        id: `p-${nextId++}`, kind: 'mark', layer: 'default', parent,
        pose: { x: b.x, y: b.y, width: b.width, height: b.height }, data: { path, fill, stroke },
      } as { id: string };
    },
    ...(containers ? {
      createContainerNode: (_sourceId: NodeId, { parent, bounds }: { parent: string | null; bounds: Rect }) =>
        ({ id: `g-${nextId++}`, kind: 'group', layer: 'default', parent, pose: bounds, data: {} }) as { id: string },
    } : {}),
    applyOps: (ops, label) => {
      scene.applyBatch(ops, label ?? 'Create Outlines', { ...defaultCommitAdapter(scene), ...adapter });
    },
  };
  const select = (...ids: string[]) => scene.setSelection(ids.map(asNodeId));
  return { scene, adapter, add, select };
}

describe('applyCreateOutlines', () => {
  it('replaces a node with a path node carrying its outline, fill and stroke', () => {
    const { scene, adapter, add, select } = setup();
    add('g', ONE);
    select('g');
    const result = applyCreateOutlines(adapter);
    if (result.kind !== 'applied') throw new Error(result.kind);
    expect(scene.get(asNodeId('g'))).toBeUndefined();
    const [id] = result.resultIds;
    const data = scene.get(asNodeId(id!))!.data;
    expect(data.fill).toEqual({ paint: RED });
    expect(data.stroke).toEqual(STROKE);
    expect(boundsOfPath(data.path!)).toMatchObject({ x: 0, y: 0, width: 40, height: 20 });
    expect([...scene.getSelection()]).toEqual([asNodeId(id!)]);
  });

  it("keeps the node's place in the stacking order", () => {
    const { scene, adapter, add, select } = setup();
    add('below', RECT);
    add('g', ONE);
    add('above', RECT);
    select('g');
    const result = applyCreateOutlines(adapter);
    if (result.kind !== 'applied') throw new Error(result.kind);
    expect(scene.roots).toEqual([asNodeId('below'), asNodeId(result.resultIds[0]!), asNodeId('above')]);
  });

  it('is one undo step that brings the nodes back where they were', () => {
    const { scene, adapter, add, select } = setup();
    add('a', ONE);
    add('mid', RECT);
    add('b', ONE);
    select('a', 'mid', 'b');
    const result = applyCreateOutlines(adapter);
    if (result.kind !== 'applied') throw new Error(result.kind);
    expect(result.resultIds).toHaveLength(2);
    // Members of the selection with no outline stay selected, in place.
    expect([...scene.getSelection()]).toEqual([asNodeId(result.resultIds[0]!), asNodeId('mid'), asNodeId(result.resultIds[1]!)]);

    scene.undo();
    expect(scene.roots).toEqual([asNodeId('a'), asNodeId('mid'), asNodeId('b')]);
    expect([...scene.getSelection()]).toEqual([asNodeId('a'), asNodeId('mid'), asNodeId('b')]);
  });

  it('changes nothing when any selected outline cannot be built', () => {
    const { scene, adapter, add, select } = setup();
    add('ok', ONE);
    add('bad', { gem: 'broken' });
    select('ok', 'bad');
    const result = applyCreateOutlines(adapter);
    if (result.kind !== 'failed') throw new Error(result.kind);
    expect(result.error).toBeInstanceOf(NodeOutlineError);
    expect(scene.roots).toEqual([asNodeId('ok'), asNodeId('bad')]);
  });

  it('is a no-op when the selection holds no outline that inks', () => {
    const { adapter, add, select } = setup();
    add('shape', RECT);
    add('blank', BLANK);
    select('shape', 'blank');
    expect(applyCreateOutlines(adapter)).toEqual({ kind: 'noop', reason: 'no-outlines' });
  });

  it("gives each paint its own path, under one container in the node's slot", () => {
    const { scene, adapter, add, select } = setup();
    add('below', RECT);
    add('g', TWO_PAINT);
    add('above', RECT);
    select('g');
    const result = applyCreateOutlines(adapter);
    if (result.kind !== 'applied') throw new Error(result.kind);
    const [gid] = result.resultIds;
    expect(result.resultIds).toHaveLength(1);
    expect(scene.get(asNodeId(gid!))!.kind).toBe('group');
    expect(scene.roots).toEqual([asNodeId('below'), asNodeId(gid!), asNodeId('above')]);
    const kids = scene.childrenOf(asNodeId(gid!)).map((id) => scene.get(id)!.data);
    expect(kids.map((d) => d.fill)).toEqual([{ paint: RED }, { paint: BLUE }]);
    expect([...scene.getSelection()]).toEqual([asNodeId(gid!)]);

    scene.undo();
    expect(scene.roots).toEqual([asNodeId('below'), asNodeId('g'), asNodeId('above')]);
    expect(scene.get(asNodeId(gid!))).toBeUndefined();
    expect([...scene.getSelection()]).toEqual([asNodeId('g')]);
  });

  it("lays the paths flat in the node's slot when the adapter mints no containers", () => {
    const { scene, adapter, add, select } = setup({ containers: false });
    add('below', RECT);
    add('g', TWO_PAINT);
    add('above', RECT);
    select('below', 'g');
    const result = applyCreateOutlines(adapter);
    if (result.kind !== 'applied') throw new Error(result.kind);
    const [red, blue] = result.resultIds.map(asNodeId);
    expect(scene.roots).toEqual([asNodeId('below'), red, blue, asNodeId('above')]);
    expect([red, blue].map((id) => scene.get(id!)!.data.fill)).toEqual([{ paint: RED }, { paint: BLUE }]);
    expect([...scene.getSelection()]).toEqual([asNodeId('below'), red, blue]);

    scene.undo();
    expect(scene.roots).toEqual([asNodeId('below'), asNodeId('g'), asNodeId('above')]);
  });
});
