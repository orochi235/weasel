import { describe, expect, it } from 'vitest';
import { renderHook } from '@testing-library/react';
import { createElement, type ReactNode } from 'react';
import {
  editAnchorSetTracked, pathInWorld, polygonFromPoints, reverseSubpaths, setSubpathStart, type PolygonPath,
} from '@weasel-js/geom';
import type { VertexWidth } from '@weasel-js/paint';
import type { ActionDeps, ImmediateInvoker } from '@weasel-js/routing';
import { DepRegistryProvider, useDepRegistry } from '@weasel-js/routing/react';
import { createScene } from 'core/scene/scene';
import type { NodeId, RectPose, Scene } from 'core/scene/types';
import type { SelectionApi } from 'core/selection/useSelection';
import { defaultCommitAdapter } from 'interactions/actions/defaultCommitAdapter';
import { deleteAnchorsAction } from 'interactions/actions/defaults/anchorEditing';
import { insertPathAnchorAction } from 'interactions/actions/defaults/insertPathAnchor';
import type { EditAnchorsDep } from 'interactions/actions/depSchema';
import { useEditAnchorsDepSource, type EditAnchorsStateRef } from './editAnchors';

type Data = { path: PolygonPath; stroke: { width: number; vertexWidths: VertexWidth[] } };
const VIEW = { get: () => ({ x: 0, y: 0, scale: { x: 1, y: 1 } }), set: () => {} };
const PAIR = { left: 1, right: 3 };
const WIDTHS: VertexWidth[] = [2, PAIR, 6, NaN];

/** A square at (100, 100), 40 on a side, in edit mode, its stroke 4 wide with a width per corner. */
function setup() {
  const scene = createScene<Data, 'main', RectPose>({ systemLayers: [{ id: 'main' }] });
  const id = scene.add({
    kind: 'mark', layer: 'main', pose: { x: 100, y: 100, width: 40, height: 40 },
    data: {
      path: polygonFromPoints([{ x: 100, y: 100 }, { x: 140, y: 100 }, { x: 140, y: 140 }, { x: 100, y: 140 }]),
      stroke: { width: 4, vertexWidths: WIDTHS },
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
    getTool: () => null,
    setTool: () => {},
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
  const dep = () => (result.current.get as (key: string) => EditAnchorsDep)('editAnchors');
  const deps = () => ({ editAnchors: dep(), view: VIEW }) as unknown as ActionDeps;
  const run = (action: { invoker?: unknown }, params?: Record<string, unknown>) =>
    (action.invoker as ImmediateInvoker).run(deps(), params);
  const edit = (fn: Parameters<typeof editAnchorSetTracked>[1]) => {
    const node = scene.get(id)!;
    const next = editAnchorSetTracked(pathInWorld(node.data.path, node.pose) as PolygonPath, fn)!;
    dep().applyEdit(id, next.path, 'edit', next.origins);
  };
  return {
    scene, run, edit,
    select: (...flat: number[]) => { selected = new Set(flat); },
    widths: () => scene.get(id)!.data.stroke.vertexWidths,
  };
}

describe('anchor edits on a stroke with a width per anchor', () => {
  it('gives an inserted anchor a width between its neighbors\', each side on its own', () => {
    const t = setup();
    t.run(insertPathAnchorAction, { world: { x: 110, y: 100 } });
    expect(t.widths()).toEqual([2, { left: 1, right: 1.5 }, PAIR, 6, NaN]);
  });

  it('drops a deleted anchor\'s width, and undo puts it back', () => {
    const t = setup();
    t.select(1);
    t.run(deleteAnchorsAction);
    expect(t.widths()).toEqual([2, 6, NaN]);
    t.scene.undo();
    expect(t.widths()).toEqual(WIDTHS);
  });

  it('turns the widths with the anchors when the start moves', () => {
    const t = setup();
    t.edit((set) => setSubpathStart(set, 2));
    expect(t.widths()).toEqual([6, NaN, 2, PAIR]);
  });

  it('runs the widths backward on a reverse, swapping the sides of a pair', () => {
    const t = setup();
    t.edit((set) => reverseSubpaths(set));
    expect(t.widths()).toEqual([2, NaN, 6, { left: 3, right: 1 }]);
    t.scene.undo();
    expect(t.widths()).toEqual(WIDTHS);
  });
});
