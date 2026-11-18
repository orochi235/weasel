/**
 * Editing path anchors on a parallax plane. The plane here zooms (factor 0 against a
 * 2x camera), so a drag reaches it scaled as well as offset — an offset alone
 * would hide a missing conversion from every delta-only action.
 */
import { describe, it, expect } from 'vitest';
import type { Action, BindingOptions, InvocationCtx, OngoingHandle, OngoingInvoker } from '@weasel-js/routing';
import { PATH_L, PATH_M, PATH_Z, type PolygonPath } from '@weasel-js/geom';
import {
  asNodeId, createScene, type RectPose, type Scene, type SelectionApi, type View, type ViewApi,
} from '@weasel-js/core';
import { createEditAnchorsDepForTests as makeEditAnchorsDep } from '@weasel-js/core/test-seams';
import { editAnchorsAction } from './editAnchors/editAnchors';
import { areaSelectAnchorsAction, selectAnchorAction } from './anchorEditing';

// Camera panned to x=100 at 2x; the sky does not zoom and pans with it, so its
// world is the camera's doubled and shifted: plane = (2x - 100, 2y).
const CAMERA: View = { x: 100, y: 0, scale: { x: 2, y: 2 } };
const SKY = { pan: 1, zoom: 0 };

type S = Scene<unknown, string, unknown>;

function makeScene(): S {
  // `sun` is stored at (100,100) 40x40 in the sky, so it paints over camera
  // (100,50) 20x20.
  return createScene<unknown, 'sky' | 'main', RectPose>({
    systemLayers: [{ id: 'main' }, { id: 'sky', parallax: SKY }],
    initial: [
      { id: asNodeId('sun'), kind: 'mark', layer: 'sky', pose: { x: 100, y: 100, width: 40, height: 40 }, data: {} },
    ],
  }) as unknown as S;
}

const viewDep = (): ViewApi => ({ get: () => CAMERA, set: () => {} });

function ctxOf(
  scene: S,
  start: { x: number; y: number },
  current: { x: number; y: number },
  extra: { deps?: Record<string, unknown>; affordance?: unknown } = {},
): InvocationCtx {
  return {
    world: current,
    modifiers: { alt: false, ctrl: false, meta: false, shift: false },
    deps: {
      selection: { get: () => ['sun'], clear: () => {}, set: () => {} } as unknown as SelectionApi,
      scene,
      view: viewDep(),
      ...extra.deps,
    },
    drag: {
      start,
      current,
      delta: { x: current.x - start.x, y: current.y - start.y },
      ...(extra.affordance ? { affordance: extra.affordance } : {}),
    },
  } as unknown as InvocationCtx;
}

function drag(
  action: Action,
  scene: S,
  from: { x: number; y: number },
  to: { x: number; y: number },
  extra: Parameters<typeof ctxOf>[3] = {},
  opts?: BindingOptions,
): OngoingHandle {
  const handle = (action.invoker as OngoingInvoker).start(ctxOf(scene, from, from, extra), opts);
  handle.onMove!(ctxOf(scene, from, to, extra));
  handle.onEnd!(ctxOf(scene, from, to, extra), 'commit');
  return handle;
}

/** M(100,100) L(140,100) L(120,140) Z, in the sky's world. */
const triangle = (): PolygonPath => ({
  kind: 'polygon',
  commands: new Uint8Array([PATH_M, PATH_L, PATH_L, PATH_Z]),
  coords: new Float32Array([100, 100, 140, 100, 120, 140]),
  fillRule: 'nonzero',
});

describe('editing path anchors on a parallax plane', () => {
  it('drags a path anchor on a plane as far as the pointer went', () => {
    const scene = makeScene();
    const edits: PolygonPath[] = [];
    const editAnchors = makeEditAnchorsDep({
      editingId: 'sun',
      getEditablePath: () => triangle(),
      applyEdit: (_id, p) => { edits.push(p as PolygonPath); },
    });
    // Anchor 0 is sky (100,100), camera (100,50); 10 camera right is 20 sky.
    drag(editAnchorsAction, scene, { x: 100, y: 50 }, { x: 110, y: 50 }, {
      deps: { editAnchors },
      affordance: { kind: 'anchor:0', targetIds: ['sun'] },
    });
    expect(Array.from(edits[0].coords.slice(0, 2))).toEqual([120, 100]);
  });

  it('selects the path anchor a click lands on where the plane draws it', () => {
    const scene = makeScene();
    const editAnchors = makeEditAnchorsDep({ editingId: 'sun', getEditablePath: () => triangle() });
    const run = selectAnchorAction.invoker;
    if (run?.timing !== 'immediate') throw new Error('expected immediate');
    // Anchor 1 is sky (140,100): camera (120,50).
    run.run(
      { editAnchors, scene, view: viewDep(), selection: { get: () => [] } } as never,
      { world: { x: 120, y: 50 }, additive: false },
    );
    expect([...editAnchors.selectedAnchors]).toEqual([1]);
  });

  it('marquees path anchors on a plane where the plane draws them', () => {
    const scene = makeScene();
    const editAnchors = makeEditAnchorsDep({ editingId: 'sun', getEditablePath: () => triangle() });
    // Camera 115..125 x 45..55 is sky 130..150 x 90..110: anchor 1 only.
    drag(areaSelectAnchorsAction, scene, { x: 115, y: 45 }, { x: 125, y: 55 }, { deps: { editAnchors } });
    expect([...editAnchors.selectedAnchors]).toEqual([1]);
  });
});
