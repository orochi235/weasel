/**
 * A real scene with text and a Create Outlines adapter over it, and a real
 * font, for tests of path gestures that convert text: the conversion's slot,
 * selection, and undo entry are scene surgery a stub would let slide.
 */
import { vi, type Mock } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { loadFontOutlines, registerFontOutlines } from '@weasel-js/font';
import { _resetFontOutlinesForTests, _resetFontRegistryForTests } from '@weasel-js/font/test-seams';
import { boundsOfPath, type Path, type Rect } from '@weasel-js/geom';
import {
  asNodeId, type CreateOutlinesAdapter, createScene, defaultCommitAdapter, type NodeId, type TextOutlineSource,
} from '@weasel-js/core';

const INTER_TTF = resolve(import.meta.dirname, '../../../../../assets/fonts/inter/inter.ttf');

/** Register the test face, `sm-inter`, with its outlines loaded. */
export async function loadTestFont(): Promise<void> {
  _resetFontRegistryForTests();
  _resetFontOutlinesForTests();
  registerFontOutlines('sm-inter', {}, new Uint8Array(readFileSync(INTER_TTF)).buffer);
  await loadFontOutlines('sm-inter');
}

export interface Data extends Partial<TextOutlineSource> { path?: Path }
type Pose = { x: number; y: number; width: number; height: number };

/** 'Hi' at 100px in `family`. */
export const TEXT = (family = 'sm-inter'): Data =>
  ({ text: 'Hi', style: { fontFamily: family, fontSize: 100 }, fill: { paint: { kind: 'solid', color: '#c00' } } });

/** A scene, its outlines adapter, and the deps a path gesture reads; `outlines: false` leaves the adapter out. */
export function outlineScene({ outlines = true } = {}) {
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
  const notices: { warn: Mock } = { warn: vi.fn() };
  const selection = { get: () => scene.getSelection(), set: (ids: readonly string[]) => scene.setSelection(ids.map(asNodeId)) };
  const deps = {
    scene, selection, history: scene.history, notices,
    view: { get: () => ({ scale: { x: 1, y: 1 } }) },
    ...(outlines ? { createOutlinesAdapter: adapter } : {}),
  } as never;
  return { scene, add, deps, notices, adapter };
}

