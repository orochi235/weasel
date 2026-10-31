/**
 * The Smudge brush over text, against a real scene and a real font: the
 * conversion, its slot, and the one undo entry are scene surgery a stub would
 * let slide.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { loadFontOutlines, registerFontOutlines } from '@weasel-js/font';
import { _resetFontOutlinesForTests, _resetFontRegistryForTests } from '@weasel-js/font/test-seams';
import { boundsOfPath, type Path, type Rect } from '@weasel-js/geom';
import type { InvocationCtx, OngoingInvoker } from '@weasel-js/routing';
import {
  applyCreateOutlines, asNodeId, type CreateOutlinesAdapter, createScene, defaultCommitAdapter, type NodeId, type TextOutlineSource,
} from '@weasel-js/core';
import { smudgeBrushAction } from './smudgeBrush';

const INTER_TTF = resolve(import.meta.dirname, '../../../../assets/fonts/inter/inter.ttf');

interface Data extends Partial<TextOutlineSource> { path?: Path }
type Pose = { x: number; y: number; width: number; height: number };

const TEXT = (family = 'sm-inter'): Data =>
  ({ text: 'Hi', style: { fontFamily: family, fontSize: 100 }, fill: { paint: { kind: 'solid', color: '#c00' } } });

function setup({ outlines = true } = {}) {
  const scene = createScene<Data, 'default', Pose>({ systemLayers: [{ id: 'default' }] });
  let nextId = 0;
  const add = (id: string, data: Data, extra: Record<string, unknown> = {}) =>
    scene.add({ id: asNodeId(id), kind: 'mark', layer: 'default', pose: { x: 0, y: 0, width: 200, height: 120 }, data, ...extra });
  const adapter: CreateOutlinesAdapter = {
    ...defaultCommitAdapter(scene),
    getSelection: () => [...scene.getSelection()],
    setSelection: (ids) => { scene.setSelection(ids.map(asNodeId)); },
    getTextSource: (id) => {
      const n = scene.get(asNodeId(id));
      if (!n || n.kind !== 'mark' || n.data.text == null) return undefined;
      return { data: n.data as TextOutlineSource, pose: n.pose };
    },
    createPathNode: (path, _source, { fill, parent }) => {
      const b = boundsOfPath(path);
      return { id: `p-${nextId++}`, kind: 'mark', layer: 'default', parent, pose: { x: b.x, y: b.y, width: b.width, height: b.height }, data: { path, fill } } as { id: string };
    },
    createContainerNode: (_s: NodeId, { parent, bounds }: { parent: string | null; bounds: Rect }) =>
      ({ id: `g-${nextId++}`, kind: 'group', layer: 'default', parent, pose: bounds, data: {} }) as { id: string },
    applyOps: (ops, label) => { scene.applyBatch(ops, label ?? 'Create Outlines', { ...defaultCommitAdapter(scene), ...adapter }); },
  };
  const notices = { warn: vi.fn() };
  const selection = { get: () => scene.getSelection(), set: (ids: readonly string[]) => scene.setSelection(ids.map(asNodeId)) };
  const deps = {
    scene, selection, history: scene.history, notices,
    view: { get: () => ({ scale: { x: 1, y: 1 } }) },
    ...(outlines ? { createOutlinesAdapter: adapter } : {}),
  } as never;
  return { scene, add, deps, notices, adapter };
}

const at = (deps: never, x: number, y: number) => ({ deps, world: { x, y } }) as unknown as InvocationCtx;
const invoker = smudgeBrushAction.invoker as OngoingInvoker;
const PARAMS = { params: { radiusPx: 30, strength: 1 } };

/** A stroke from (x, y0) to (x, y1) in a few dabs, ended with `reason`. */
function stroke(deps: never, x: number, y0: number, y1: number, reason: 'commit' | 'cancel' = 'commit') {
  const handle = invoker.start(at(deps, x, y0), PARAMS);
  for (let i = 1; i <= 4; i++) handle.onMove?.(at(deps, x, y0 + ((y1 - y0) * i) / 4));
  handle.onEnd?.(at(deps, x, y1), reason);
  return handle;
}

beforeEach(async () => {
  _resetFontRegistryForTests();
  _resetFontOutlinesForTests();
  registerFontOutlines('sm-inter', {}, new Uint8Array(readFileSync(INTER_TTF)).buffer);
  await loadFontOutlines('sm-inter');
});

describe('smudgeBrushAction over text', () => {
  it('converts text the brush reaches to outlines and smudges them, as one undo entry', () => {
    const { scene, add, deps } = setup();
    add('t', TEXT());
    scene.history.clear();
    stroke(deps, 30, 60, 20);
    expect(scene.get(asNodeId('t'))).toBeUndefined();
    expect(scene.history.entries().undo.map((e) => e.label)).toEqual(['Smudge brush']);
    const plain = setup();
    plain.add('t', TEXT());
    applyCreateOutlines(plain.adapter, [asNodeId('t')]);
    const paths = (s: typeof scene) => s.renderOrderNodes().filter((n) => n.data.path).map((n) => JSON.stringify(n.data.path));
    expect(paths(scene)).toHaveLength(paths(plain.scene).length);
    expect(paths(scene)).not.toEqual(paths(plain.scene));
    scene.undo();
    expect(scene.get(asNodeId('t'))?.data.text).toBe('Hi');
    expect(scene.renderOrderNodes().every((n) => !n.data.path)).toBe(true);
  });

  it('leaves text the brush never reaches as text', () => {
    const { scene, add, deps } = setup();
    add('t', TEXT());
    add('far', { path: { kind: 'rect', x: 1000, y: 1000, width: 50, height: 50 } });
    stroke(deps, 1025, 990, 1010);
    expect(scene.get(asNodeId('t'))?.data.text).toBe('Hi');
  });

  it('with a selection, converts only selected text', () => {
    const { scene, add, deps } = setup();
    add('a', TEXT());
    add('b', TEXT());
    scene.setSelection([asNodeId('b')]);
    stroke(deps, 30, 60, 20);
    expect(scene.get(asNodeId('a'))?.data.text).toBe('Hi');
    expect(scene.get(asNodeId('b'))).toBeUndefined();
  });

  it('keeps the outlines selected, and a selected group is smudged as its leaves', () => {
    const { scene, add, deps } = setup();
    // Two paints: two paths, in a group.
    add('t', { ...TEXT(), runs: [{ text: 'H' }, { text: 'i', fill: { paint: { kind: 'solid', color: '#00c' } } }] } as Data);
    scene.setSelection([asNodeId('t')]);
    stroke(deps, 30, 60, 20);
    const [group] = scene.getSelection();
    expect(scene.get(group)?.kind).toBe('group');
    scene.history.clear();
    stroke(deps, 30, 70, 30);
    expect(scene.history.undoDepth()).toBe(1);
  });

  it('with nothing selected, passes over locked and hidden text', () => {
    const { scene, add, deps } = setup();
    add('locked', TEXT(), { locked: true });
    add('hidden', TEXT(), { hidden: true });
    expect(smudgeBrushAction.enabled!(deps)).not.toBe(true);
    stroke(deps, 30, 60, 20);
    expect(scene.get(asNodeId('locked'))?.data.text).toBe('Hi');
    expect(scene.get(asNodeId('hidden'))?.data.text).toBe('Hi');
  });

  it('puts the text back exactly when the stroke is canceled', () => {
    const { scene, add, deps } = setup();
    add('t', TEXT());
    scene.history.clear();
    const before = JSON.stringify(scene.toJSON());
    stroke(deps, 30, 60, 20, 'cancel');
    expect(JSON.stringify(scene.toJSON())).toBe(before);
    expect(scene.history.undoDepth()).toBe(0);
  });

  it('leaves text whose face has no outlines, and says so once', () => {
    const { scene, add, deps, notices } = setup();
    add('a', TEXT('nowhere'));
    add('b', TEXT('nowhere'));
    scene.history.clear();
    stroke(deps, 30, 60, 20);
    expect(scene.get(asNodeId('a'))?.data.text).toBe('Hi');
    expect(scene.get(asNodeId('b'))?.data.text).toBe('Hi');
    expect(notices.warn).toHaveBeenCalledTimes(1);
    expect(notices.warn.mock.calls[0][0]).toContain('nowhere');
    expect(scene.history.undoDepth()).toBe(0);
  });

  it('skips text in a host with no outlines adapter', () => {
    const { scene, add, deps } = setup({ outlines: false });
    add('t', TEXT());
    expect(smudgeBrushAction.enabled!(deps)).not.toBe(true);
    stroke(deps, 30, 60, 20);
    expect(scene.get(asNodeId('t'))?.data.text).toBe('Hi');
  });
});
