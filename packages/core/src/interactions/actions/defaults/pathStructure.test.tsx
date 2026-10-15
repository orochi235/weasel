import { describe, expect, it } from 'vitest';
import { renderHook } from '@testing-library/react';
import { createElement, type ReactNode } from 'react';
import { PathBuilder, pathInWorld, pathToAnchors, polygonFromPoints, type PolygonPath } from '@weasel-js/geom';
import type { ActionDeps, ImmediateInvoker } from '@weasel-js/routing';
import { ActionDisabledReason } from '@weasel-js/routing';
import { DepRegistryProvider, useDepRegistry } from '@weasel-js/routing/react';
import type { Skin } from '@weasel-js/animator';
import { createScene } from 'core/scene/scene';
import type { NodeId, RectPose, Scene } from 'core/scene/types';
import type { SelectionApi } from 'core/selection/useSelection';
import { defaultCommitAdapter } from 'interactions/actions/defaultCommitAdapter';
import type { EditAnchorsDep } from 'interactions/actions/depSchema';
import { useEditAnchorsDepSource, type EditAnchorsStateRef } from 'canvas/deps/editAnchors';
import { reversePathAction, setPathStartAction } from './pathStructure';
import { convertSegmentAtAction, convertSegmentsAction } from './convertSegments';
import { anchorFieldsOf, setAnchorFieldAction } from './anchorFields';

type Data = { path: PolygonPath; skin?: Skin; vertexColors?: number[] };
const VIEW = { get: () => ({ x: 0, y: 0, scale: { x: 1, y: 1 } }), set: () => {} };
const RED = [1, 0, 0, 1], GREEN = [0, 1, 0, 1], BLUE = [0, 0, 1, 1], WHITE = [1, 1, 1, 1];
const SQUARE = [{ x: 100, y: 100 }, { x: 140, y: 100 }, { x: 140, y: 140 }, { x: 100, y: 140 }];

/** A square at (100, 100), 40 on a side, colored per corner, in edit mode when `editing`. */
function setup(path: PolygonPath = polygonFromPoints(SQUARE), editing = true) {
  const scene = createScene<Data, 'main', RectPose>({ systemLayers: [{ id: 'main' }] });
  const id = scene.add({
    kind: 'leaf', layer: 'main', pose: { x: 100, y: 100, width: 40, height: 40 },
    data: { path, vertexColors: [...RED, ...GREEN, ...BLUE, ...WHITE], skin: { a: [1, 0, 0, 0], b: [0, 1, 1, 1] } },
  });
  let selected: ReadonlySet<number> = new Set();
  const state: EditAnchorsStateRef = {
    getEditingId: () => (editing ? id : ''),
    setEditingId: () => {},
    getSelectedAnchors: () => selected,
    setSelectedAnchors: (next) => { selected = next; },
    getMarquee: () => null,
    setMarquee: () => {},
  };
  const loose = scene as unknown as Scene<unknown, string, unknown>;
  const applyOps = (ops: Parameters<typeof scene.applyBatch>[0], label = '') => {
    scene.applyBatch(ops, label, defaultCommitAdapter(loose));
  };
  const selection = { current: [id] as NodeId[], get: () => [id], set: () => {} } as unknown as SelectionApi;
  const { result } = renderHook(() => {
    useEditAnchorsDepSource(loose, selection, { applyOps }, state);
    return useDepRegistry();
  }, { wrapper: ({ children }: { children: ReactNode }) => createElement(DepRegistryProvider, null, children) });
  const deps = () => ({
    editAnchors: (result.current.get as (key: string) => EditAnchorsDep)('editAnchors'),
    view: VIEW, scene, selection, applyOps,
  }) as unknown as ActionDeps;
  const run = (action: { invoker?: unknown }, params?: Record<string, unknown>) =>
    (action.invoker as ImmediateInvoker).run(deps(), params);
  const world = () => pathInWorld(scene.get(id)!.data.path, scene.get(id)!.pose) as PolygonPath;
  return {
    scene, id, run, deps, world,
    select: (...flat: number[]) => { selected = new Set(flat); },
    selected: () => [...selected],
    corners: () => pathToAnchors(world()).anchors[0].map((a) => [a.x, a.y]),
    data: () => scene.get(id)!.data,
  };
}

describe('setPathStart', () => {
  it('starts the closed path at the selected anchor, its colors and weights going with it', () => {
    const t = setup();
    t.select(2);
    expect(setPathStartAction.enabled!(t.deps())).toBe(true);
    t.run(setPathStartAction);
    expect(t.corners()).toEqual([[140, 140], [100, 140], [100, 100], [140, 100]]);
    expect(t.data().vertexColors).toEqual([...BLUE, ...WHITE, ...RED, ...GREEN]);
    expect(t.data().skin).toEqual({ a: [0, 0, 1, 0], b: [1, 1, 0, 1] });
    expect(t.selected()).toEqual([0]);
    t.scene.undo();
    expect(t.corners()[0]).toEqual([100, 100]);
  });

  it('is off for an anchor already first, and with more than one selected', () => {
    const t = setup();
    t.select(0);
    expect(setPathStartAction.enabled!(t.deps())).toBe(ActionDisabledReason.NotApplicable);
    t.select(1, 2);
    expect(setPathStartAction.enabled!(t.deps())).toBe(ActionDisabledReason.SelectionRequired);
  });
});

describe('reversePath', () => {
  it('reverses the edited path from the same start, the selection following its anchor', () => {
    const t = setup();
    t.select(1);
    t.run(reversePathAction);
    expect(t.corners()).toEqual([[100, 100], [100, 140], [140, 140], [140, 100]]);
    expect(t.data().vertexColors).toEqual([...RED, ...WHITE, ...BLUE, ...GREEN]);
    expect(t.selected()).toEqual([3]);
  });

  it('reverses every selected path whole outside path edit, in one undo step', () => {
    const t = setup(polygonFromPoints(SQUARE), false);
    expect(reversePathAction.enabled!(t.deps())).toBe(true);
    const before = t.data();
    t.run(reversePathAction);
    expect(t.corners()).toEqual([[100, 100], [100, 140], [140, 140], [140, 100]]);
    expect(t.data().skin).toEqual({ a: [1, 0, 0, 0], b: [0, 1, 1, 1] });
    t.scene.undo();
    expect(t.data()).toBe(before);
  });
});

describe('convertSegments', () => {
  it('curves the segment between two selected anchors, then straightens it again', () => {
    const t = setup();
    t.select(0, 1);
    t.run(convertSegmentsAction);
    const [a, b] = pathToAnchors(t.world()).anchors[0];
    expect(a.outHandle!.x).toBeCloseTo(100 + 40 / 3, 4);
    expect(b.inHandle!.x).toBeCloseTo(140 - 40 / 3, 4);
    t.run(convertSegmentsAction);
    expect(pathToAnchors(t.world()).anchors[0][0].outHandle).toBeUndefined();
  });

  it('needs a selected segment', () => {
    const t = setup();
    t.select(0, 2);
    expect(convertSegmentsAction.enabled!(t.deps())).toBe(ActionDisabledReason.SelectionRequired);
  });

  it('converts the segment under a Shift+double-click', () => {
    const t = setup();
    expect(convertSegmentAtAction.enabled!(t.deps(), { x: 140, y: 120 })).toBe(true);
    expect(convertSegmentAtAction.enabled!(t.deps(), { x: 120, y: 120 })).toBe(ActionDisabledReason.NotApplicable);
    t.run(convertSegmentAtAction, { worldX: 140, worldY: 120 });
    const [, b, c] = pathToAnchors(t.world()).anchors[0];
    expect(b.outHandle?.y).toBeCloseTo(100 + 40 / 3, 4);
    expect(c.inHandle?.y).toBeCloseTo(140 - 40 / 3, 4);
  });
});

describe('setAnchorField', () => {
  it('reads the selection as fields, mixed where it differs, and writes a value or an offset', () => {
    const t = setup();
    t.select(1, 2);
    expect(anchorFieldsOf(t.deps())).toEqual({ x: 140, y: null });
    t.run(setAnchorFieldAction, { field: 'x', to: 150 });
    expect(t.corners()).toEqual([[100, 100], [150, 100], [150, 140], [100, 140]]);
    t.run(setAnchorFieldAction, { field: 'y', by: -10 });
    expect(t.corners()).toEqual([[100, 100], [150, 90], [150, 130], [100, 140]]);
    t.scene.undo();
    expect(t.corners()[1]).toEqual([150, 100]);
  });

  it("shows a lone anchor's handles", () => {
    const curve = new PathBuilder().moveTo(100, 100).curveTo(110, 100, 140, 130, 140, 140).lineTo(100, 140).build();
    const t = setup(curve);
    t.select(0);
    expect(anchorFieldsOf(t.deps())).toMatchObject({ x: 100, y: 100, outX: 110, outY: 100, outAngle: 0, outLength: 10 });
    t.run(setAnchorFieldAction, { field: 'outLength', to: 20 });
    expect(pathToAnchors(t.world()).anchors[0][0].outHandle!.x).toBeCloseTo(120, 4);
  });
});
