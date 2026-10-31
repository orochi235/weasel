import { describe, expect, it } from 'vitest';
import { renderHook } from '@testing-library/react';
import { createElement, type ReactNode } from 'react';
import { polygonFromPoints, type PolygonPath } from '@weasel-js/geom';
import type { ActionDeps, ImmediateInvoker } from '@weasel-js/routing';
import { DepRegistryProvider, useDepRegistry } from '@weasel-js/routing/react';
import type { Skin } from '@weasel-js/animator';
import { createScene } from 'core/scene/scene';
import type { NodeId, RectPose, Scene } from 'core/scene/types';
import type { SelectionApi } from 'core/selection/useSelection';
import { defaultCommitAdapter } from 'interactions/actions/defaultCommitAdapter';
import { cutPathAtAnchorAction, deleteAnchorsAction } from 'interactions/actions/defaults/anchorEditing';
import { insertPathAnchorAction } from 'interactions/actions/defaults/insertPathAnchor';
import type { EditAnchorsDep } from 'interactions/actions/depSchema';
import { useEditAnchorsDepSource, type EditAnchorsStateRef } from './editAnchors';

type Data = { path: PolygonPath; skin: Skin };
const VIEW = { get: () => ({ x: 0, y: 0, scale: { x: 1, y: 1 } }), set: () => {} };

/** A skinned square at (100, 100), 40 on a side, in edit mode: corners 0 and 3 on `a`,
 *  corners 1 and 2 on `b`. */
function setup() {
  const scene = createScene<Data, 'main', RectPose>({ systemLayers: [{ id: 'main' }] });
  const id = scene.add({
    kind: 'mark', layer: 'main', pose: { x: 100, y: 100, width: 40, height: 40 },
    data: {
      path: polygonFromPoints([{ x: 100, y: 100 }, { x: 140, y: 100 }, { x: 140, y: 140 }, { x: 100, y: 140 }]),
      skin: { a: [1, 0, 0, 1], b: [0, 1, 1, 0] },
    },
  });
  let selected: ReadonlySet<number> = new Set();
  const state: EditAnchorsStateRef = {
    getEditingId: () => id,
    setEditingId: () => {},
    getSelectedAnchors: () => selected,
    setSelectedAnchors: (next) => { selected = next; },
    getMarquee: () => null,
    setMarquee: () => {},
    getSelectedMark: () => null,
    setSelectedMark: () => {},
    getExtensions: () => [],
    getHandleLocks: () => null,
    setHandleLocks: () => {},
  };
  const loose = scene as unknown as Scene<unknown, string, unknown>;
  const adapter = {
    applyOps: (ops: Parameters<typeof scene.applyBatch>[0], label = '') => {
      scene.applyBatch(ops, label, defaultCommitAdapter(loose));
    },
  };
  const selection = { current: [id] as NodeId[] } as unknown as SelectionApi;
  const { result } = renderHook(() => {
    useEditAnchorsDepSource(loose, selection, adapter, state);
    return useDepRegistry();
  }, { wrapper: ({ children }: { children: ReactNode }) => createElement(DepRegistryProvider, null, children) });
  const deps = () => ({
    editAnchors: (result.current.get as (key: string) => EditAnchorsDep)('editAnchors'),
    view: VIEW,
  }) as unknown as ActionDeps;
  const run = (action: { invoker?: unknown }, params?: Record<string, unknown>) =>
    (action.invoker as ImmediateInvoker).run(deps(), params);
  return { scene, id, run, select: (...flat: number[]) => { selected = new Set(flat); }, skin: () => scene.get(id)!.data.skin };
}

describe('anchor edits on a skinned path', () => {
  it('takes a deleted point\'s weights out, and undo puts path and weights back together', () => {
    const t = setup();
    const before = t.scene.get(t.id)!.data;
    t.select(1);
    t.run(deleteAnchorsAction);
    // Corner 1 is gone and 0 → 2 closes with a line: 0, 2, 3.
    expect(t.scene.get(t.id)!.data.path.coords).toHaveLength(6);
    expect(t.skin()).toEqual({ a: [1, 0, 1], b: [0, 1, 0] });
    t.scene.undo();
    expect(t.scene.get(t.id)!.data).toBe(before);
  });

  it('gives an inserted point weights between its neighbors\'', () => {
    const t = setup();
    t.run(insertPathAnchorAction, { world: { x: 110, y: 100 } });
    expect(t.scene.get(t.id)!.data.path.coords).toHaveLength(10);
    expect(t.skin()).toEqual({ a: [1, 0.75, 0, 0, 1], b: [0, 0.25, 1, 1, 0] });
  });

  it('carries weights around with the points of a cut subpath', () => {
    const t = setup();
    t.run(cutPathAtAnchorAction, { world: { x: 140, y: 140 } });
    expect(t.skin()).toEqual({ a: [0, 1, 1, 0, 0], b: [1, 0, 0, 1, 1] });
  });
});
