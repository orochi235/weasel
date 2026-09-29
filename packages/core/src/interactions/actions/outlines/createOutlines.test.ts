/**
 * Create Outlines against a real scene and a real font: the scene surgery is
 * the part a stub adapter would let slide (slot, undo, selection), and the
 * geometry is only worth asserting on real glyphs.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { registerFontOutlines, loadFontOutlines } from '@weasel-js/font';
import { _resetFontRegistryForTests, _resetFontOutlinesForTests } from '@weasel-js/font/test-seams';
import { boundsOfPath, pointInPath, type Path, type Rect } from '@weasel-js/geom';
import { createScene } from 'core/scene/scene';
import { asNodeId, type NodeId } from 'core/scene/types';
import { defaultCommitAdapter } from 'interactions/actions/defaultCommitAdapter';
import { TextOutlinesError, type TextOutlineSource } from 'features/text/textToPath';
import { applyCreateOutlines, type CreateOutlinesAdapter } from './createOutlines';

const INTER_TTF = resolve(import.meta.dirname, '../../../../../../assets/fonts/inter/inter.ttf');

interface Data extends Partial<TextOutlineSource> {
  path?: Path;
}
type Pose = { x: number; y: number; width: number; height: number; rotation?: number };

function setup({ containers = true }: { containers?: boolean } = {}) {
  const scene = createScene<Data, 'default', Pose>({ systemLayers: [{ id: 'default' }] });
  let nextId = 0;
  const add = (id: string, data: Data, pose: Pose = { x: 0, y: 0, width: 400, height: 150 }) =>
    scene.add({ id: asNodeId(id), kind: 'leaf', layer: 'default', pose, data });
  const adapter: CreateOutlinesAdapter = {
    ...defaultCommitAdapter(scene),
    getSelection: () => [...scene.getSelection()],
    setSelection: (ids) => { scene.setSelection(ids.map(asNodeId)); },
    getTextSource: (id) => {
      const n = scene.get(asNodeId(id));
      if (!n || n.kind !== 'leaf' || n.data.text == null) return undefined;
      return { data: n.data as TextOutlineSource, pose: n.pose };
    },
    createPathNode: (path, _sourceId, { fill, stroke, parent }) => {
      const b = boundsOfPath(path);
      return {
        id: `p-${nextId++}`,
        kind: 'leaf',
        layer: 'default',
        parent,
        pose: { x: b.x, y: b.y, width: b.width, height: b.height },
        data: { path, fill, stroke },
      } as { id: string };
    },
    ...(containers ? {
      createContainerNode: (_sourceId: NodeId, { parent, bounds }: { parent: string | null; bounds: Rect }) =>
        ({ id: `g-${nextId++}`, kind: 'container', layer: 'default', parent, pose: bounds, data: {} }) as { id: string },
    } : {}),
    applyOps: (ops, label) => {
      scene.applyBatch(ops, label ?? 'Create Outlines', { ...defaultCommitAdapter(scene), ...adapter });
    },
  };
  const select = (...ids: string[]) => scene.setSelection(ids.map(asNodeId));
  return { scene, adapter, add, select };
}

const RED = { fill: 'solid', color: '#c00' } as const;
const BLUE = { fill: 'solid', color: '#00c' } as const;
const STROKE = { width: 3, paint: { fill: 'solid', color: '#000' } } as const;
const TEXT: Data = { text: 'Hi', style: { fontFamily: 'co-inter', fontSize: 100 }, fill: RED, stroke: STROKE };
/** 'Hi' with a blue 'i': two paints, three runs. */
const TWO_PAINT: Data = {
  ...TEXT, stroke: undefined, text: 'Hil',
  runs: [{ text: 'H' }, { text: 'i', fill: BLUE }, { text: 'l' }],
};
const RECT: Data = { path: { kind: 'rect', x: 0, y: 0, width: 10, height: 10 } };

beforeEach(async () => {
  _resetFontRegistryForTests();
  _resetFontOutlinesForTests();
  registerFontOutlines('co-inter', {}, new Uint8Array(readFileSync(INTER_TTF)).buffer);
  await loadFontOutlines('co-inter');
});

describe('applyCreateOutlines', () => {
  it('replaces a text node with a path node carrying its glyphs, fill and stroke', () => {
    const { scene, adapter, add, select } = setup();
    add('t', TEXT);
    select('t');
    const result = applyCreateOutlines(adapter);
    expect(result.kind).toBe('applied');
    if (result.kind !== 'applied') return;
    expect(scene.get(asNodeId('t'))).toBeUndefined();
    const [id] = result.resultIds;
    const node = scene.get(asNodeId(id))!;
    const data = node.data as Data;
    expect(data.fill).toEqual(RED);
    expect(data.stroke).toEqual(STROKE);
    // The 'H' stem, near the left edge of the text box, is filled geometry.
    const b = boundsOfPath(data.path!);
    expect(pointInPath(data.path!, b.x + 3, b.y + b.height * 0.8)).toBe(true);
    expect([...scene.getSelection()]).toEqual([asNodeId(id)]);
  });

  it('keeps the text node\'s place in the stacking order', () => {
    const { scene, adapter, add, select } = setup();
    add('below', { path: { kind: 'rect', x: 0, y: 0, width: 10, height: 10 } });
    add('t', TEXT);
    add('above', { path: { kind: 'rect', x: 0, y: 0, width: 10, height: 10 } });
    select('t');
    const result = applyCreateOutlines(adapter);
    if (result.kind !== 'applied') throw new Error(result.kind);
    expect(scene.roots).toEqual([asNodeId('below'), asNodeId(result.resultIds[0]), asNodeId('above')]);
  });

  it('is one undo step that brings the text back where it was', () => {
    const { scene, adapter, add, select } = setup();
    add('a', TEXT);
    add('mid', { path: { kind: 'rect', x: 0, y: 0, width: 10, height: 10 } });
    add('b', { ...TEXT, text: 'Yo' });
    select('a', 'mid', 'b');
    const result = applyCreateOutlines(adapter);
    if (result.kind !== 'applied') throw new Error(result.kind);
    expect(result.resultIds).toHaveLength(2);
    // Non-text members of the selection stay selected, in place.
    expect([...scene.getSelection()]).toEqual(
      [asNodeId(result.resultIds[0]), asNodeId('mid'), asNodeId(result.resultIds[1])]);

    scene.undo();
    expect(scene.roots).toEqual([asNodeId('a'), asNodeId('mid'), asNodeId('b')]);
    expect((scene.get(asNodeId('b'))!.data as Data).text).toBe('Yo');
    expect([...scene.getSelection()]).toEqual([asNodeId('a'), asNodeId('mid'), asNodeId('b')]);
  });

  it('changes nothing when any selected text cannot be outlined', () => {
    const { scene, adapter, add, select } = setup();
    add('ok', TEXT);
    add('bad', { text: 'x', style: { fontFamily: 'no-such-face', fontSize: 40 } });
    select('ok', 'bad');
    const result = applyCreateOutlines(adapter);
    expect(result.kind).toBe('failed');
    if (result.kind !== 'failed') return;
    expect(result.error).toBeInstanceOf(TextOutlinesError);
    expect(scene.roots).toEqual([asNodeId('ok'), asNodeId('bad')]);
  });

  it('is a no-op when the selection holds no text with ink', () => {
    const { adapter, add, select } = setup();
    add('shape', { path: { kind: 'rect', x: 0, y: 0, width: 10, height: 10 } });
    add('blank', { ...TEXT, text: '   ' });
    select('shape', 'blank');
    expect(applyCreateOutlines(adapter)).toEqual({ kind: 'noop', reason: 'no-text' });
  });

  it('gives each paint its own path, under one container in the text\'s slot', () => {
    const { scene, adapter, add, select } = setup();
    add('below', RECT);
    add('t', TWO_PAINT);
    add('above', RECT);
    select('t');
    const result = applyCreateOutlines(adapter);
    if (result.kind !== 'applied') throw new Error(result.kind);
    const [gid] = result.resultIds;
    expect(result.resultIds).toHaveLength(1);
    expect(scene.get(asNodeId(gid))!.kind).toBe('container');
    expect(scene.roots).toEqual([asNodeId('below'), asNodeId(gid), asNodeId('above')]);
    const kids = scene.childrenOf(asNodeId(gid)).map((id) => scene.get(id)!.data as Data);
    expect(kids.map((d) => d.fill)).toEqual([RED, BLUE]);
    expect([...scene.getSelection()]).toEqual([asNodeId(gid)]);

    scene.undo();
    expect(scene.roots).toEqual([asNodeId('below'), asNodeId('t'), asNodeId('above')]);
    expect(scene.get(asNodeId(gid))).toBeUndefined();
    expect([...scene.getSelection()]).toEqual([asNodeId('t')]);
  });

  it('lays the paths flat in the text\'s slot when the adapter mints no containers', () => {
    const { scene, adapter, add, select } = setup({ containers: false });
    add('below', RECT);
    add('t', TWO_PAINT);
    add('above', RECT);
    select('below', 't');
    const result = applyCreateOutlines(adapter);
    if (result.kind !== 'applied') throw new Error(result.kind);
    const [red, blue] = result.resultIds.map(asNodeId);
    expect(scene.roots).toEqual([asNodeId('below'), red, blue, asNodeId('above')]);
    expect([red, blue].map((id) => (scene.get(id!)!.data as Data).fill)).toEqual([RED, BLUE]);
    expect([...scene.getSelection()]).toEqual([asNodeId('below'), red, blue]);

    scene.undo();
    expect(scene.roots).toEqual([asNodeId('below'), asNodeId('t'), asNodeId('above')]);
  });
});
