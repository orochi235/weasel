/**
 * Outline Stroke against a real scene: the slot, undo, and selection are the
 * part a stub adapter would let slide.
 */
import { describe, it, expect } from 'vitest';
import { boundsOfPath, pathFromD, pointInPath, type Path, type Rect } from '@weasel-js/geom';
import type { Paint, Stroke, Fill } from '@weasel-js/paint';
import { createScene } from 'core/scene/scene';
import { asNodeId, type NodeId } from 'core/scene/types';
import { pathPaintOf } from 'canvas/nodeShapes/nodePaint';
import { defaultCommitAdapter } from 'interactions/actions/defaultCommitAdapter';
import type { CreateOutlinesAdapter } from './createOutlines';
import { applyOutlineStroke } from './outlineStroke';

interface Data { path?: Path; fill?: Fill | null; stroke?: Stroke }
type Pose = { x: number; y: number; width: number; height: number };

const RED: Paint = { color: '#f00' };
const BLUE: Paint = { color: '#00f' };
const LINE: Path = pathFromD('M0 50 L100 50');
const BOX: Path = { kind: 'rect', x: 0, y: 0, width: 100, height: 100 };

function setup({ containers = true }: { containers?: boolean } = {}) {
  const scene = createScene<Data, 'default', Pose>({ systemLayers: [{ id: 'default' }] });
  let nextId = 0;
  const add = (id: string, data: Data) => {
    const b = data.path ? boundsOfPath(data.path) : { x: 0, y: 0, width: 10, height: 10 };
    scene.add({ id: asNodeId(id), kind: 'mark', layer: 'default', pose: b, data });
  };
  const adapter: CreateOutlinesAdapter = {
    ...defaultCommitAdapter(scene),
    getSelection: () => [...scene.getSelection()],
    setSelection: (ids) => { scene.setSelection(ids.map(asNodeId)); },
    getTextSource: () => undefined,
    getWorldPath: (id) => {
      const n = scene.get(asNodeId(id));
      return n?.kind === 'mark' ? n.data.path : undefined;
    },
    getPaint: (id) => {
      const n = scene.get(asNodeId(id));
      return n?.kind === 'mark' && n.data.path ? pathPaintOf(n.data) : undefined;
    },
    createPathNode: (path, _sourceId, { fill, stroke, parent }) => {
      const b = boundsOfPath(path);
      return {
        id: `p-${nextId++}`, kind: 'mark', layer: 'default', parent,
        pose: { x: b.x, y: b.y, width: b.width, height: b.height },
        data: { path, fill, stroke },
      } as { id: string };
    },
    ...(containers ? {
      createContainerNode: (_sourceId: NodeId, { parent, bounds }: { parent: string | null; bounds: Rect }) =>
        ({ id: `g-${nextId++}`, kind: 'group', layer: 'default', parent, pose: bounds, data: {} }) as { id: string },
    } : {}),
    applyOps: (ops, label) => {
      scene.applyBatch(ops, label ?? 'Outline Stroke', { ...defaultCommitAdapter(scene), ...adapter });
    },
  };
  const select = (...ids: string[]) => scene.setSelection(ids.map(asNodeId));
  const dataOf = (id: string) => (scene.get(asNodeId(id)) as { data: Data }).data;
  return { scene, adapter, add, select, dataOf };
}

describe('applyOutlineStroke', () => {
  it('replaces a stroked line with a path filled in the stroke\'s paint, in its slot', () => {
    const h = setup();
    h.add('below', { path: BOX, fill: { paint: BLUE } });
    h.add('line', { path: LINE, stroke: { paint: RED, width: 10 } });
    h.add('above', { path: BOX, fill: { paint: BLUE } });
    h.select('line');

    const result = applyOutlineStroke(h.adapter);

    expect(result).toEqual({ kind: 'applied', resultIds: ['p-0'] });
    expect(h.scene.get(asNodeId('line'))).toBeUndefined();
    const out = h.dataOf('p-0');
    expect(out.fill).toEqual({ paint: RED });
    expect(out.stroke).toBeUndefined();
    expect(boundsOfPath(out.path!)).toMatchObject({ x: 0, y: 45, width: 100, height: 10 });
    expect(h.scene.roots).toEqual(['below', 'p-0', 'above']);
    expect([...h.scene.getSelection()]).toEqual(['p-0']);
  });

  it('keeps a filled node\'s fill as its own path under the outline, grouped', () => {
    const h = setup();
    h.add('box', { path: BOX, fill: { paint: BLUE }, stroke: { paint: RED, width: 10 } });
    h.select('box');

    const result = applyOutlineStroke(h.adapter);

    expect(result).toEqual({ kind: 'applied', resultIds: ['g-0'] });
    const [fillId, strokeId] = h.scene.childrenOf(asNodeId('g-0'));
    expect(h.dataOf(fillId!)).toEqual({ path: BOX, fill: { paint: BLUE }, stroke: undefined });
    const ring = h.dataOf(strokeId!);
    expect(ring.fill).toEqual({ paint: RED });
    expect(boundsOfPath(ring.path!)).toMatchObject({ x: -5, y: -5, width: 110, height: 110 });
    // A ring: ink on the edge, none in the middle.
    expect(pointInPath(ring.path!, 0, 50)).toBe(true);
    expect(pointInPath(ring.path!, 50, 50)).toBe(false);
  });

  it('lays the two paths flat in the slot when the adapter mints no container', () => {
    const h = setup({ containers: false });
    h.add('box', { path: BOX, fill: { paint: BLUE }, stroke: { paint: RED, width: 10 } });
    h.add('above', { path: BOX, fill: { paint: BLUE } });
    h.select('box');

    expect(applyOutlineStroke(h.adapter)).toEqual({ kind: 'applied', resultIds: ['p-0', 'p-1'] });
    expect(h.scene.roots).toEqual(['p-0', 'p-1', 'above']);
    expect(h.dataOf('p-1').fill).toEqual({ paint: RED });
  });

  it('leaves unstroked nodes alone and selected', () => {
    const h = setup();
    h.add('plain', { path: BOX, fill: { paint: BLUE } });
    h.add('line', { path: LINE, stroke: { paint: RED, width: 4 } });
    h.select('plain', 'line');

    applyOutlineStroke(h.adapter);

    expect(h.scene.get(asNodeId('plain'))).toBeDefined();
    expect([...h.scene.getSelection()]).toEqual(['plain', 'p-0']);
  });

  it('is a no-op when nothing selected is stroked', () => {
    const h = setup();
    h.add('plain', { path: BOX, fill: { paint: BLUE } });
    h.add('hairless', { path: LINE, stroke: { paint: RED, width: 0 } });
    h.select('plain', 'hairless');

    expect(applyOutlineStroke(h.adapter)).toEqual({ kind: 'noop', reason: 'no-stroke' });
    expect(h.scene.roots).toEqual(['plain', 'hairless']);
  });

  it('resolves a { px } width against the scale it is given', () => {
    const h = setup();
    h.add('line', { path: LINE, stroke: { paint: RED, width: { px: 10 } } });
    h.select('line');

    applyOutlineStroke(h.adapter, { scale: 2 });

    expect(boundsOfPath(h.dataOf('p-0').path!).height).toBeCloseTo(5);
  });

  it('undoes to the stroked node', () => {
    const h = setup();
    h.add('line', { path: LINE, stroke: { paint: RED, width: 10 } });
    h.select('line');
    applyOutlineStroke(h.adapter);

    h.scene.undo();

    expect(h.scene.roots).toEqual(['line']);
    expect(h.dataOf('line').stroke).toEqual({ paint: RED, width: 10 });
  });
});
