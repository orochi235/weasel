/**
 * An anchor drag on a path something derives from, with the gesture's previews published to the
 * scene (`publishPreviews`): the derived nodes follow every frame, a release commits once, and a
 * cancel leaves the document and its history as they were.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import type { InvocationCtx, OngoingHandle } from '@weasel-js/routing';
import { registerFontOutlines, type OutlineFace } from '@weasel-js/font';
import { _resetFontRegistryForTests, _resetFontOutlinesForTests } from '@weasel-js/font/test-seams';
import { _resetLayoutCacheForTests } from '@weasel-js/text/test-seams';
import { pathFromD, rectPath, type PolygonPath } from '@weasel-js/geom';
import { loadTextOutlines, type TextOutlineSource } from '@weasel-js/text';
import { publishPreviews } from 'canvas/publishPreviews';
import { effectivePose } from 'core/scene/effectivePose';
import { pathEffectNode } from 'core/scene/pathEffects/derive';
import { createScene } from 'core/scene/scene';
import { resolveEditablePathOf, storeEditablePath } from 'features/paths/editablePath';
import { asNodeId, type RectPose } from 'core/scene/types';
import { PATH_EFFECT_DERIVATIONS, withPathEffectsRegistry } from 'features/pathEffects';
import { makeEditAnchorsDep, stubDeps } from '../testUtils';
import { editAnchorsAction } from './action';

const BARS: OutlineFace = {
  unitsPerEm: 1000, ascender: 0.8, advanceOf: () => 0.6, kernOf: () => 0, glyphD: () => 'M0 -0.5L0.2 -0.5L0.2 0L0 0Z',
};
const TEXT: TextOutlineSource = {
  text: 'Hi', style: { fontFamily: 'bars', fontSize: 100 }, fill: { paint: { kind: 'solid', color: '#000' } },
};
const T = asNodeId('t');
const P = asNodeId('p');
const B = asNodeId('b');
const ALONG = asNodeId('along');
const BLEND = asNodeId('blend');

beforeEach(() => {
  _resetFontRegistryForTests();
  _resetFontOutlinesForTests();
  _resetLayoutCacheForTests();
});

async function setup() {
  registerFontOutlines('bars', {}, new ArrayBuffer(4), { parser: () => BARS });
  await loadTextOutlines(TEXT);
  const scene = createScene<unknown, 'main', RectPose>({
    systemLayers: [{ id: 'main' }],
    registry: withPathEffectsRegistry(),
    initial: [
      { id: T, kind: 'mark', layer: 'main', pose: { x: 0, y: 0, width: 400, height: 120 }, data: TEXT },
      { id: P, kind: 'mark', layer: 'main', pose: { x: 0, y: 200, width: 400, height: 0 }, data: { path: pathFromD('M0 0 L400 0') } },
      { id: B, kind: 'mark', layer: 'main', pose: { x: 600, y: 200, width: 10, height: 10 }, data: { path: rectPath(0, 0, 10, 10) } },
      { ...pathEffectNode({ kind: 'textAlong' }, [T, P], 'main', PATH_EFFECT_DERIVATIONS), id: ALONG },
      { ...pathEffectNode({ kind: 'blend', steps: 2, rotate: false }, [P, B], 'main', PATH_EFFECT_DERIVATIONS), id: BLEND },
    ],
  });
  const handles = new Set<OngoingHandle>();
  const listeners = new Set<() => void>();
  const notify = () => { for (const fn of listeners) fn(); };
  const stop = publishPreviews(scene, {
    getInFlightHandles: () => handles.values(),
    subscribe: (fn) => {
      listeners.add(fn);
      return () => listeners.delete(fn);
    },
  });
  // A path stored in `data.path` under a rect pose, read and committed through the scene as the canvas's dep does.
  const shape = () => ({ pose: scene.get(P)!.pose, data: scene.get(P)!.data });
  const dep = makeEditAnchorsDep({
    editingId: P,
    getStorageKind: () => 'data',
    getNodeShape: shape,
    getEditablePath: () => resolveEditablePathOf(shape()),
    applyEdit: (_id, worldPath, label) => {
      const next = storeEditablePath(shape(), worldPath as PolygonPath)!;
      scene.batch(label, () => {
        scene.update(P, { data: next.data });
        scene.setPose(P, next.pose as RectPose);
      });
    },
  });
  const ctxAt = (x: number, y: number): InvocationCtx => ({
    world: { x, y },
    screen: { x, y },
    modifiers: { alt: false, ctrl: false, meta: false, shift: false },
    deps: stubDeps({ selection: { get: () => [P] }, editAnchors: dep }),
    drag: { start: { x: 400, y: 200 }, current: { x, y }, delta: { x: x - 400, y: y - 200 }, affordance: { kind: 'anchor:1' } },
  });
  /** Press the path's second anchor, as the dispatcher does: start, then notify. */
  const press = (): OngoingHandle => {
    if (editAnchorsAction.invoker?.timing !== 'ongoing') throw new Error('expected an ongoing invoker');
    const handle = editAnchorsAction.invoker.start(ctxAt(400, 200), undefined);
    handles.add(handle);
    notify();
    return handle;
  };
  const move = (handle: OngoingHandle, x: number, y: number) => {
    handle.onMove!(ctxAt(x, y));
    notify();
  };
  const end = (handle: OngoingHandle, reason: 'commit' | 'cancel', x: number, y: number) => {
    handle.onEnd!(ctxAt(x, y), reason);
    handles.delete(handle);
    notify();
  };
  const heightOf = (id: typeof ALONG) => effectivePose(scene, scene.get(id)!).height;
  return { scene, stop, press, move, end, heightOf };
}

describe('an anchor drag on a path something derives from', () => {
  it('re-derives the text along it and the blend from it on every frame', async () => {
    const { scene, press, move, heightOf } = await setup();
    const stored = scene.get(P)!.data;
    const along = [heightOf(ALONG)];
    const blend = [heightOf(BLEND)];
    const handle = press();
    for (const y of [300, 400]) {
      move(handle, 400, y);
      along.push(heightOf(ALONG));
      blend.push(heightOf(BLEND));
    }
    expect(along[1]).toBeGreaterThan(along[0]);
    expect(along[2]).toBeGreaterThan(along[1]);
    expect(blend[1]).toBeGreaterThan(blend[0]);
    expect(blend[2]).toBeGreaterThan(blend[1]);
    expect(scene.get(P)!.data).toBe(stored);
  });

  it('commits once on release, where the last frame showed it', async () => {
    const { scene, press, move, end, heightOf } = await setup();
    const before = scene.historyEntries().length;
    const handle = press();
    move(handle, 400, 300);
    move(handle, 400, 400);
    const shown = heightOf(ALONG);
    end(handle, 'commit', 400, 400);
    expect(scene.historyEntries()).toHaveLength(before + 1);
    expect(scene.overrides.ids()).toEqual([]);
    expect(heightOf(ALONG)).toBeCloseTo(shown);
  });

  it('leaves the document and its history as they were on a cancel', async () => {
    const { scene, press, move, end, heightOf } = await setup();
    const stored = scene.get(P)!;
    const entries = scene.historyEntries();
    const height = heightOf(ALONG);
    const handle = press();
    move(handle, 400, 300);
    end(handle, 'cancel', 400, 300);
    expect(scene.get(P)).toBe(stored);
    expect(scene.historyEntries()).toEqual(entries);
    expect(scene.overrides.ids()).toEqual([]);
    expect(heightOf(ALONG)).toBe(height);
  });

  it('shows the dragged path over a write made mid-drag, and over its undo', async () => {
    const { scene, press, move } = await setup();
    const handle = press();
    move(handle, 400, 300);
    const shown = () => scene.overrides.read(P)?.data?.(scene.get(P)!.data) as { path: unknown; stroke?: unknown };
    const dragged = shown().path;
    const stroke = { paint: { color: '#f00' }, width: 3 };
    scene.update(P, { data: { ...(scene.get(P)!.data as object), stroke } });
    expect(shown()).toMatchObject({ path: dragged, stroke });
    scene.undo();
    expect(shown().path).toBe(dragged);
    expect(shown().stroke).toBeUndefined();
  });

  it('stops publishing once stopped', async () => {
    const { scene, stop, press, move } = await setup();
    stop();
    const height = effectivePose(scene, scene.get(ALONG)!).height;
    move(press(), 400, 300);
    expect(effectivePose(scene, scene.get(ALONG)!).height).toBe(height);
  });
});
