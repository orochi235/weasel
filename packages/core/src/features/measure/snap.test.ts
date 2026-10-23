/** A measurement snapping through the `snap` dep's `point` sessions. */
import { describe, expect, it } from 'vitest';
import type { InvocationCtx, OngoingInvoker } from '@weasel-js/routing';
import { pathFromD } from '@weasel-js/geom';
import { createScene } from 'core/scene/scene';
import { asNodeId, type RectPose, type Scene } from 'core/scene/types';
import type { SnapDep } from 'interactions/actions/snapDep';
import { createSnapOutcomeStore } from 'features/snap/outcomeStore';
import { createSession2d } from 'features/snap/session2d';
import { lineSource } from 'features/snap/testing/sessionDep';
import type { SnapSource } from 'features/snap/types';
import { pathSnapSource } from 'features/paths/pathSnap/pathSnapSource';
import { MEASURE_ACTION_IDS } from './actionIds';
import { measureEndsOf } from './measurement';
import { createMeasurements, measureIds } from './measurements';
import { measureCreateAction, measureDragAction } from './measureGestures';
import { measureEndSource } from './measureHit';
import { MEASURE_AFFORDANCE_KIND } from './measureLayer';

type Point = { x: number; y: number };
type AnyScene = Scene<unknown, string, unknown>;

const KEYS = { alt: false, ctrl: false, meta: false, shift: false };

/** A scene of path nodes, as the path source reads one. */
function pathScene(paths: Record<string, string>): AnyScene {
  const nodes = new Map(Object.entries(paths).map(([id, d]) => [
    asNodeId(id), { id: asNodeId(id), kind: 'mark' as const, layer: 'default', parent: null, pose: pathFromD(d), data: {} },
  ]));
  return { nodes, layers: [{ id: 'default' }], getVersion: () => 1 } as unknown as AnyScene;
}

/** `point` sessions over `sources`, reading `targets`, at zoom 1. */
function pointDep(targets: AnyScene, sources: readonly SnapSource[]): SnapDep {
  const store = createSnapOutcomeStore();
  return {
    begin: (req) => createSession2d({
      req, sources, probes: [{ id: 'pointer', at: req.press, role: 'pointer' }],
      view: () => ({ x: 0, y: 0, scale: { x: 1, y: 1 } }), reachPx: 8, scene: targets, store,
    }),
  };
}

function rig(snap: (scene: AnyScene) => SnapDep) {
  const scene = createScene<object, 'main' | 'notes', RectPose>({
    systemLayers: [{ id: 'main' }, { id: 'notes', annotation: true }],
  }) as unknown as AnyScene;
  const ms = createMeasurements({ layer: 'notes' });
  const deps = { scene, selection: { get: () => [], set: () => {} }, snap: snap(scene) };
  const ctx = (p: Point, from: Point, mods: Partial<typeof KEYS> = {}, affordance?: unknown) => ({
    world: p, screen: p, modifiers: { ...KEYS, ...mods }, deps,
    drag: { start: from, current: p, delta: { x: p.x - from.x, y: p.y - from.y }, ...(affordance ? { affordance } : {}) },
  }) as unknown as InvocationCtx;
  const drag = (id: string, from: Point, to: Point, mods: Partial<typeof KEYS> = {}, affordance?: unknown) => {
    const action = [measureCreateAction(ms), measureDragAction(ms)].find((a) => a.id === id)!;
    const h = (action.invoker as OngoingInvoker).start(ctx(from, from, {}, affordance), undefined);
    h.onMove!(ctx(to, from, mods));
    h.onEnd!(ctx(to, from, mods), 'commit');
  };
  const ends = () => measureIds(scene, ms).map((id) => measureEndsOf(scene.get(id)));
  return { scene, ms, drag, ends };
}

describe('measure snapping', () => {
  it('starts on a path anchor and, with Shift, ends where the 15° line from it meets a guide', () => {
    const paths = pathScene({ p: 'M10 10 L10 200' });
    const r = rig(() => pointDep(paths, [pathSnapSource(), lineSource({ x: 110, y: 0 }, { x: 0, y: 1 })]));
    r.drag(MEASURE_ACTION_IDS.measure, { x: 12, y: 9 }, { x: 108, y: 38 }, { shift: true });
    const [m] = r.ends();
    expect(m!.start).toEqual({ x: expect.closeTo(10, 9), y: expect.closeTo(10, 9) });
    expect(m!.end.x).toBeCloseTo(110, 9);
    expect(m!.end.y).toBeCloseTo(10 + 100 * Math.tan(Math.PI / 12), 9);
  });

  it('starts on the end of another measurement', () => {
    const r = rig((scene) => pointDep(scene, [measureEndSource()]));
    r.drag(MEASURE_ACTION_IDS.measure, { x: 0, y: 0 }, { x: 100, y: 0 });
    r.drag(MEASURE_ACTION_IDS.measure, { x: 97, y: 3 }, { x: 100, y: 60 });
    expect(r.ends()[1]!.start).toEqual({ x: expect.closeTo(100, 9), y: expect.closeTo(0, 9) });
  });

  it('moves an end onto another measurement\'s end, and never onto its own', () => {
    const r = rig((scene) => pointDep(scene, [measureEndSource()]));
    r.drag(MEASURE_ACTION_IDS.measure, { x: 0, y: 0 }, { x: 100, y: 0 });
    r.drag(MEASURE_ACTION_IDS.measure, { x: 0, y: 50 }, { x: 60, y: 50 });
    const [first, second] = measureIds(r.scene, r.ms);
    const onEnd = (id: string) => ({ kind: MEASURE_AFFORDANCE_KIND, payload: { id, part: 'end' } });
    r.drag(MEASURE_ACTION_IDS.drag, { x: 60, y: 50 }, { x: 98, y: 4 }, {}, onEnd(second!));
    expect(r.ends()[1]!.end).toEqual({ x: expect.closeTo(100, 9), y: expect.closeTo(0, 9) });
    r.ms.picked.set(first!);
    r.drag(MEASURE_ACTION_IDS.drag, { x: 100, y: 0 }, { x: 3, y: 2 }, {}, onEnd(first!));
    expect(r.ends()[0]!.end).toEqual({ x: 3, y: 2 });
  });
});
