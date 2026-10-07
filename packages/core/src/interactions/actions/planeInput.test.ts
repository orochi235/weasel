/**
 * Editing nodes on a parallax plane. The plane here zooms (factor 0 against a
 * 2x camera), so a drag reaches it scaled as well as offset — an offset alone
 * would hide a missing conversion from every delta-only action.
 */
import { describe, it, expect, vi } from 'vitest';
import type {
  Action, BindingOpts, DepRegistry, InvocationCtx, OngoingHandle, OngoingInvoker, OngoingOverlay,
} from '@weasel-js/routing';
import { buildDepsFromRequires } from '@weasel-js/routing';
import { createScene } from 'core/scene/scene';
import { asNodeId, type NodeId, type RectPose, type Scene } from 'core/scene/types';
import type { SelectionApi } from 'core/selection/useSelection';
import type { View } from 'core/viewport/view';
import { moveAction } from './defaults/move';
import { resizeAction } from './defaults/resize';
import { rotateAction } from './defaults/rotate';
import { cloneAction } from './defaults/clone';
import { insertAction } from './defaults/insert';
import { nudgeRightAction } from './defaults/nudge';
import { editAnchorsAction } from './defaults/editAnchors';
import { selectAnchorAction, marqueeAnchorsAction } from './defaults/anchorEditing';
import { makeEditAnchorsDep } from './testUtils';
import { PATH_L, PATH_M, PATH_Z, type PolygonPath } from '@weasel-js/geom';
import { inPlane, selectionLayer } from './planeInput';
import type { InsertDep, ViewApi } from './depSchema';

// Camera panned to x=100 at 2x; the sky does not zoom and pans with it, so its
// world is the camera's doubled and shifted: plane = (2x - 100, 2y).
const CAMERA: View = { x: 100, y: 0, scale: { x: 2, y: 2 } };
const SKY = { pan: 1, zoom: 0 };
const cam = (px: number, py: number) => ({ x: (px + 100) / 2, y: py / 2 });

type S = Scene<unknown, string, unknown>;

function makeScene(): S {
  // `sun` is stored at (100,100) 40x40 in the sky, so it paints over camera
  // (100,50) 20x20.
  return createScene<unknown, 'sky' | 'main', RectPose>({
    systemLayers: [{ id: 'main' }, { id: 'sky', parallax: SKY }],
    initial: [
      { id: asNodeId('sun'), kind: 'leaf', layer: 'sky', pose: { x: 100, y: 100, width: 40, height: 40 }, data: {} },
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
      selection: { get: () => ['sun'], clear: () => {} } as unknown as SelectionApi,
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
  opts?: BindingOpts,
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

const poseOf = (scene: S, id: string) => scene.get(asNodeId(id))!.pose as RectPose;

describe('editing a node on a parallax plane', () => {
  it('moves a plane node as far as the pointer went over it', () => {
    const scene = makeScene();
    // 10 camera units right is 20 in the sky.
    drag(moveAction, scene, { x: 110, y: 60 }, { x: 120, y: 60 });
    expect(poseOf(scene, 'sun')).toMatchObject({ x: 120, y: 100 });
  });

  it('resizes a plane node to where the handle was dragged', () => {
    const scene = makeScene();
    // Bottom-right corner paints at camera (120,70); drag it to (130,80),
    // which is sky (160,160).
    drag(resizeAction, scene, { x: 120, y: 70 }, { x: 130, y: 80 }, {
      affordance: { kind: 'handle:bottom-right', targetIds: ['sun'], anchor: { x: 'min', y: 'min' } },
    });
    expect(poseOf(scene, 'sun')).toMatchObject({ x: 100, y: 100, width: 60, height: 60 });
  });

  it('rotates a plane node about where it is drawn', () => {
    const scene = makeScene();
    // The sun's center paints at camera (110,60). A drag from due east of it
    // to due south is a quarter turn — only when measured about that point.
    drag(rotateAction, scene, { x: 160, y: 60 }, { x: 110, y: 110 });
    expect(poseOf(scene, 'sun').rotation).toBeCloseTo(Math.PI / 2, 6);
  });

  it('clones a plane node to where the pointer let go', () => {
    const scene = makeScene();
    drag(cloneAction, scene, { x: 110, y: 60 }, { x: 120, y: 60 });
    const copy = scene.renderOrderNodes().find((n) => n.id !== 'sun')!;
    expect(copy.layer).toBe('sky');
    expect(copy.pose).toMatchObject({ x: 120, y: 100 });
  });

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
      { worldX: 120, worldY: 50, additive: false },
    );
    expect([...editAnchors.selectedAnchors]).toEqual([1]);
  });

  it('marquees path anchors on a plane where the plane draws them', () => {
    const scene = makeScene();
    const editAnchors = makeEditAnchorsDep({ editingId: 'sun', getEditablePath: () => triangle() });
    // Camera 115..125 x 45..55 is sky 130..150 x 90..110: anchor 1 only.
    drag(marqueeAnchorsAction, scene, { x: 115, y: 45 }, { x: 125, y: 55 }, { deps: { editAnchors } });
    expect([...editAnchors.selectedAnchors]).toEqual([1]);
  });

  it('nudges a plane node one unit of its own world, whatever the camera', () => {
    const scene = makeScene();
    const run = nudgeRightAction.invoker;
    if (run?.timing !== 'immediate') throw new Error('expected immediate');
    run.run({ selection: { get: () => ['sun'] }, scene, view: viewDep() } as never);
    expect(poseOf(scene, 'sun')).toMatchObject({ x: 101, y: 100 });
  });

  it('inserts onto a plane where the drag was drawn, and previews it there', () => {
    const scene = makeScene();
    const calls: { x: number; y: number; width: number; height: number }[] = [];
    const insert: InsertDep = {
      layer: () => 'sky',
      commit: (bounds) => { calls.push(bounds); return 'n' as NodeId; },
    };
    const from = cam(20, 20);
    const to = cam(40, 60);
    const handle = (insertAction.invoker as OngoingInvoker).start(
      ctxOf(scene, from, from, { deps: { insert } }), { params: { kind: 'rect' } },
    );
    handle.onMove!(ctxOf(scene, from, to, { deps: { insert } }));
    const preview = handle.overlay!() as Extract<OngoingOverlay, { kind: 'insertPreview' }>;
    // The chrome is the camera's; the committed node is the sky's.
    expect(preview.bounds).toEqual({ x: 60, y: 10, width: 10, height: 20 });
    handle.onEnd!(ctxOf(scene, from, to, { deps: { insert } }), 'commit');
    expect(calls).toEqual([{ x: 20, y: 20, width: 20, height: 40 }]);
  });

  it('reads no dep the wrapped action did not declare', () => {
    // The dispatcher's dev deps bag throws on an undeclared read. Rotate
    // declares neither `snap` nor `nodeAtPoint`.
    const scene = makeScene();
    const registry = {
      get: (name: string) => ({
        scene, view: viewDep(), selection: { get: () => ['sun'] },
      } as Record<string, unknown>)[name],
    } as unknown as DepRegistry;
    const at = (p: { x: number; y: number }) => ({
      ...ctxOf(scene, { x: 160, y: 60 }, p),
      deps: buildDepsFromRequires(rotateAction, registry),
    });
    const handle = (rotateAction.invoker as OngoingInvoker).start(at({ x: 160, y: 60 }));
    handle.onMove!(at({ x: 110, y: 110 }));
    handle.onEnd!(at({ x: 110, y: 110 }), 'commit');
    expect(poseOf(scene, 'sun').rotation).toBeCloseTo(Math.PI / 2, 6);
  });

  it('leaves an edit on a camera layer exactly as it was', () => {
    const scene = createScene<unknown, 'main', RectPose>({
      systemLayers: [{ id: 'main' }],
      initial: [{ id: asNodeId('sun'), kind: 'leaf', layer: 'main', pose: { x: 100, y: 100, width: 40, height: 40 }, data: {} }],
    }) as unknown as S;
    drag(moveAction, scene, { x: 110, y: 110 }, { x: 120, y: 110 });
    expect(poseOf(scene, 'sun')).toMatchObject({ x: 110, y: 100 });
  });
});

/** The sun on the 2x sky and the moon on the camera's own layer, side by side
 *  on screen: the moon paints over camera (60,50) 20x20, the sun over
 *  (100,50) 20x20. */
function twoPlaneScene(): S {
  return createScene<unknown, 'sky' | 'main', RectPose>({
    systemLayers: [{ id: 'main' }, { id: 'sky', parallax: SKY }],
    initial: [
      { id: asNodeId('sun'), kind: 'leaf', layer: 'sky', pose: { x: 100, y: 100, width: 40, height: 40 }, data: {} },
      { id: asNodeId('moon'), kind: 'leaf', layer: 'main', pose: { x: 60, y: 50, width: 20, height: 20 }, data: {} },
      { id: asNodeId('box'), kind: 'container', layer: 'main', pose: { x: 200, y: 0, width: 100, height: 100 }, data: {} },
    ],
  }) as unknown as S;
}

const selecting = (ids: string[]) => ({
  selection: { get: () => ids, clear: () => {} } as unknown as SelectionApi,
});

const centerOf = (p: RectPose) => ({ x: p.x + p.width / 2, y: p.y + p.height / 2 });

describe('editing a selection that spans planes', () => {
  // Each case runs with either node leading the selection: the plane the edit
  // is measured in must not decide where anything lands.
  for (const order of [['sun', 'moon'], ['moon', 'sun']]) {
    describe(`led by the ${order[0]}`, () => {
      it('moves each node as far as the pointer went over it', () => {
        const scene = twoPlaneScene();
        drag(moveAction, scene, { x: 110, y: 60 }, { x: 120, y: 60 }, { deps: selecting(order) });
        expect(poseOf(scene, 'sun')).toMatchObject({ x: 120, y: 100 });
        expect(poseOf(scene, 'moon')).toMatchObject({ x: 70, y: 50 });
      });

      it('resizes both about the corner of the box drawn around them', () => {
        const scene = twoPlaneScene();
        // The pair spans camera (60,50)-(120,70); dragging its bottom-right
        // corner 60 right doubles it across.
        drag(resizeAction, scene, { x: 120, y: 70 }, { x: 180, y: 70 }, {
          deps: selecting(order),
          affordance: { kind: 'handle:bottom-right', targetIds: [order[0]], anchor: { x: 'min', y: 'min' } },
        });
        expect(poseOf(scene, 'moon')).toMatchObject({ x: 60, y: 50, width: 40, height: 20 });
        // Camera (140,50) 40x20, in the sky.
        expect(poseOf(scene, 'sun')).toMatchObject({ x: 180, y: 100, width: 80, height: 40 });
      });

      it('turns both about the center of the box drawn around them', () => {
        const scene = twoPlaneScene();
        // The pair's center paints at camera (90,60): east of it to south is a
        // quarter turn.
        drag(rotateAction, scene, { x: 140, y: 60 }, { x: 90, y: 110 }, { deps: selecting(order) });
        const moon = poseOf(scene, 'moon');
        const sun = poseOf(scene, 'sun');
        expect(moon.rotation).toBeCloseTo(Math.PI / 2, 6);
        expect(sun.rotation).toBeCloseTo(Math.PI / 2, 6);
        expect(centerOf(moon).x).toBeCloseTo(90, 6);
        expect(centerOf(moon).y).toBeCloseTo(40, 6);
        // Camera (90,80), in the sky.
        expect(centerOf(sun).x).toBeCloseTo(80, 6);
        expect(centerOf(sun).y).toBeCloseTo(160, 6);
      });

      it('clones each node to where the pointer let go', () => {
        const scene = twoPlaneScene();
        drag(cloneAction, scene, { x: 110, y: 60 }, { x: 120, y: 60 }, { deps: selecting(order) });
        const copies = scene.renderOrderNodes().filter((n) => !['sun', 'moon', 'box'].includes(n.id));
        expect(copies.find((n) => n.layer === 'sky')!.pose).toMatchObject({ x: 120, y: 100 });
        expect(copies.find((n) => n.layer === 'main')!.pose).toMatchObject({ x: 70, y: 50 });
      });
    });
  }

  it('lands a node dropped into a container on another plane where it was drawn', () => {
    const scene = twoPlaneScene();
    // 130 camera right puts the sun over camera (230,50), inside the box.
    drag(moveAction, scene, { x: 110, y: 60 }, { x: 240, y: 60 }, {
      deps: { ...selecting(['sun']), nodeAtPoint: () => asNodeId('box') },
    }, { params: { reparentOnDrop: 'top' } });
    const sun = scene.get(asNodeId('sun'))!;
    expect(sun.layer).toBe('main');
    expect(sun.parent).toBe('box');
    expect(sun.pose).toMatchObject({ x: 230, y: 50, width: 20, height: 20 });
  });

  it('hands a layout on another plane the dragged node in that plane', () => {
    const scene = twoPlaneScene();
    const handed: unknown[] = [];
    const probes: { x: number; y: number }[] = [];
    const layout = {
      snap: { pickTarget: (t: unknown[], p: { x: number; y: number }) => { probes.push(p); return t[0] ?? null; } },
      childPoses: () => new Map(),
      getDropTargets: (_c: unknown, _k: unknown, dragged: { pose: unknown }) => {
        handed.push(dragged.pose);
        return [{ pose: dragged.pose, origin: { x: 0, y: 0 } }];
      },
      reflowPoses: () => new Map(),
      commitDrop: () => [],
    };
    const handle = (moveAction.invoker as OngoingInvoker).start(ctxOf(scene, { x: 110, y: 60 }, { x: 110, y: 60 }, {
      deps: { ...selecting(['sun']), layout: { getLayout: (id: string) => (id === 'box' ? layout : null) } },
    }));
    handle.onMove!(ctxOf(scene, { x: 110, y: 60 }, { x: 240, y: 60 }));
    expect(handed.at(-1)).toMatchObject({ x: 230, y: 50, width: 20, height: 20 });
    expect(probes.at(-1)).toEqual({ x: 240, y: 60 });
  });
});

describe('inPlane', () => {
  /** An action that records what it was handed. */
  function probe() {
    const seen: InvocationCtx[] = [];
    const action: Action = {
      id: 'probe',
      label: 'Probe',
      requires: ['nodeAtPoint', 'snap'],
      invoker: {
        timing: 'ongoing',
        start(ctx) {
          seen.push(ctx);
          return { onMove: (c) => { seen.push(c); } };
        },
      },
    };
    return { seen, action: inPlane(action, selectionLayer) };
  }

  it('reads the camera through the plane, so screen pixels convert at its scale', () => {
    const { seen, action } = probe();
    (action.invoker as OngoingInvoker).start(ctxOf(makeScene(), { x: 110, y: 60 }, { x: 110, y: 60 }));
    expect(seen[0].deps.view!.get()).toEqual({ x: 100, y: 0, scale: { x: 1, y: 1 } });
  });

  it('keeps world-point deps speaking the camera\'s world', () => {
    const { seen, action } = probe();
    const nodeAtPoint = vi.fn(() => null);
    const snap = { point: vi.fn((p: { x: number; y: number }) => ({ x: Math.round(p.x), y: Math.round(p.y) })) };
    (action.invoker as OngoingInvoker).start(
      ctxOf(makeScene(), { x: 110, y: 60 }, { x: 110, y: 60 }, { deps: { nodeAtPoint, snap } }),
    );
    const deps = seen[0].deps as { nodeAtPoint(p: unknown): unknown; snap: { point(p: unknown): unknown } };
    deps.nodeAtPoint({ x: 120, y: 120 });
    expect(nodeAtPoint).toHaveBeenCalledWith({ x: 110, y: 60 }, undefined);
    // Sky 121 is camera 110.5, which rounds to 111 — sky 122.
    expect(deps.snap.point({ x: 121, y: 0 })).toEqual({ x: 122, y: 0 });
  });

  it('follows the pointer when the camera pans under a held drag', () => {
    const { seen, action } = probe();
    // A sky that pans at half the camera's rate, so a pan moves it on screen.
    const scene = createScene<unknown, 'sky', RectPose>({
      systemLayers: [{ id: 'sky', parallax: { pan: 0.5, zoom: 0 } }],
      initial: [{ id: asNodeId('sun'), kind: 'leaf', layer: 'sky', pose: { x: 0, y: 0, width: 10, height: 10 }, data: {} }],
    }) as unknown as S;
    let camera = CAMERA;
    const view: ViewApi = { get: () => camera, set: () => {} };
    const at = (p: { x: number; y: number }) => ctxOf(scene, { x: 110, y: 60 }, p, { deps: { view } });
    const handle = (action.invoker as OngoingInvoker).start(at({ x: 110, y: 60 }));
    // The camera slides 20 right, and the pointer, held still on screen, reads
    // 20 further right in the camera's world. The sky slid half as far, so
    // the pointer has crossed 10 of its units — not the 40 that scaling the
    // camera's delta into the sky would claim, nor the camera's own 20.
    camera = { ...CAMERA, x: 120 };
    handle.onMove!(at({ x: 130, y: 60 }));
    expect(seen[1].drag!.delta).toEqual({ x: 10, y: 0 });
  });
});
