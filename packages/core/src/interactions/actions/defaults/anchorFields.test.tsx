import { describe, expect, it } from 'vitest';
import { renderHook } from '@testing-library/react';
import { createElement, type ReactNode } from 'react';
import {
  editAnchorSetTracked, PathBuilder, pathInWorld, pathToAnchors, polygonFromPoints, setSubpathStart, type PolygonPath,
} from '@weasel-js/geom';
import type { ActionDeps, ImmediateInvoker } from '@weasel-js/routing';
import { DepRegistryProvider, useDepRegistry } from '@weasel-js/routing/react';
import type { Skin } from '@weasel-js/animator';
import { createScene } from 'core/scene/scene';
import type { NodeId, RectPose, Scene } from 'core/scene/types';
import type { SelectionApi } from 'core/selection/useSelection';
import { defaultCommitAdapter } from 'interactions/actions/defaultCommitAdapter';
import type { EditAnchorsDep } from 'interactions/actions/depSchema';
import { useEditAnchorsDepSource, type EditAnchorsStateRef } from 'canvas/deps/editAnchors';
import { anchorFieldsOf, setAnchorFieldAction } from './anchorFields';

type Data = { path: PolygonPath; skin?: Skin; vertexColors?: number[] };
const RED = [1, 0, 0, 1], GREEN = [0, 1, 0, 1], BLUE = [0, 0, 1, 1], WHITE = [1, 1, 1, 1];
const SQUARE = [{ x: 100, y: 100 }, { x: 140, y: 100 }, { x: 140, y: 140 }, { x: 100, y: 140 }];

/** A square at (100, 100), 40 on a side, colored and weighted per corner, in edit mode. */
function setup(path: PolygonPath = polygonFromPoints(SQUARE)) {
  const scene = createScene<Data, 'main', RectPose>({ systemLayers: [{ id: 'main' }] });
  const id = scene.add({
    kind: 'mark', layer: 'main', pose: { x: 100, y: 100, width: 40, height: 40 },
    data: { path, vertexColors: [...RED, ...GREEN, ...BLUE, ...WHITE], skin: { a: [1, 0, 0, 0], b: [0, 1, 1, 1] } },
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
  const applyOps = (ops: Parameters<typeof scene.applyBatch>[0], label = '') => {
    scene.applyBatch(ops, label, defaultCommitAdapter(loose));
  };
  const selection = { current: [id] as NodeId[] } as unknown as SelectionApi;
  const { result } = renderHook(() => {
    useEditAnchorsDepSource(loose, selection, { applyOps }, state);
    return useDepRegistry();
  }, { wrapper: ({ children }: { children: ReactNode }) => createElement(DepRegistryProvider, null, children) });
  const dep = () => (result.current.get as (key: string) => EditAnchorsDep)('editAnchors');
  const deps = () => ({ editAnchors: dep() }) as unknown as ActionDeps;
  const run = (params: Record<string, unknown>) => (setAnchorFieldAction.invoker as ImmediateInvoker).run(deps(), params);
  const world = () => pathInWorld(scene.get(id)!.data.path, scene.get(id)!.pose) as PolygonPath;
  return {
    scene, id, run, deps, dep, world,
    select: (...flat: number[]) => { selected = new Set(flat); },
    corners: () => pathToAnchors(world()).anchors[0].map((a) => [a.x, a.y]),
    data: () => scene.get(id)!.data,
  };
}

describe('an anchor edit that reorders anchors', () => {
  it('carries vertex colors and skin weights with their anchors, as one undo step', () => {
    const t = setup();
    const next = editAnchorSetTracked(t.world(), (set) => setSubpathStart(set, 2))!;
    t.dep().applyEdit(t.id, next.path, 'Make start point', next.origins);
    expect(t.corners()).toEqual([[140, 140], [100, 140], [100, 100], [140, 100]]);
    expect(t.data().vertexColors).toEqual([...BLUE, ...WHITE, ...RED, ...GREEN]);
    expect(t.data().skin).toEqual({ a: [0, 0, 1, 0], b: [1, 1, 0, 1] });
    t.scene.undo();
    expect(t.data().vertexColors).toEqual([...RED, ...GREEN, ...BLUE, ...WHITE]);
  });
});

describe('setAnchorField', () => {
  it('reads the selection as fields, mixed where it differs, and writes a value or an offset', () => {
    const t = setup();
    t.select(1, 2);
    expect(anchorFieldsOf(t.deps())).toEqual({ x: 140, y: null });
    t.run({ field: 'x', to: 150 });
    expect(t.corners()).toEqual([[100, 100], [150, 100], [150, 140], [100, 140]]);
    t.run({ field: 'y', by: -10 });
    expect(t.corners()).toEqual([[100, 100], [150, 90], [150, 130], [100, 140]]);
    t.scene.undo();
    expect(t.corners()[1]).toEqual([150, 100]);
  });

  it("shows a lone anchor's handles", () => {
    const curve = new PathBuilder().moveTo(100, 100).curveTo(110, 100, 140, 130, 140, 140).lineTo(100, 140).build();
    const t = setup(curve);
    t.select(0);
    expect(anchorFieldsOf(t.deps())).toMatchObject({ x: 100, y: 100, outX: 110, outY: 100, outAngle: 0, outLength: 10 });
    t.run({ field: 'outLength', to: 20 });
    expect(pathToAnchors(t.world()).anchors[0][0].outHandle!.x).toBeCloseTo(120, 4);
  });
});
