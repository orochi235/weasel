/**
 * Tests for `usePreviewGhostLayer` — specifically the dispatcher
 * surface: when a dispatcher's in-flight `OngoingHandle` exposes
 * `previewIds()` / `previewPose(id)`, the layer renders a ghost for that
 * id using the slot's `drawOne`. Removing the handle removes the ghost.
 */
import { describe, it, expect } from 'vitest';
import { renderHook } from '@testing-library/react';
import { createScene } from 'core/scene/scene';
import type { View } from 'core/viewport/view';
import type { DrawCommand, GroupDrawCommand } from '@weasel-js/renderer';
import type { Node } from 'core/scene/types';
import type { Dispatcher } from '@weasel-js/routing';
import type { OngoingHandle } from '@weasel-js/routing';
import { usePreviewGhostLayer } from './usePreviewGhostLayer';
import { renderThenAbandon } from '@weasel-js/react/testing/abandonRender';
import type { GesturePreviewSource } from '../gestureBounds';
import { INHERIT } from '@weasel-js/paint';
import { withInheritedPaints } from '../inheritedPaints';
import type { NodePaintCtx } from '../nodeShapeTypes';

interface Data { label: string }
interface Pose { x: number; y: number; width: number; height: number }

const COMMITTED_POSE: Pose = { x: 0, y: 0, width: 10, height: 10 };
const PREVIEW_POSE: Pose = { x: 100, y: 200, width: 10, height: 10 };
const VIEW: View = { x: 0, y: 0, scale: { x: 1, y: 1 } };
const DIMS = { width: 800, height: 600 };

/** drawOne stub: emits a single rect at the pose's (x, y) so the test can
 *  inspect whether the preview pose (not the committed pose) reached the slot. */
function drawOne(_node: Node<Data, 'main', Pose>, pose: Pose, _view: View): DrawCommand[] {
  return [{
    kind: 'path',
    path: { kind: 'rect', x: pose.x, y: pose.y, width: pose.width, height: pose.height },
    fill: { paint: { color: '#000' } },
  }];
}

/** Minimal Dispatcher stub exposing only what the preview layer reads. */
function makeDispatcher(handles: OngoingHandle[]): Dispatcher {
  const map = new Map<string, OngoingHandle>(handles.map((h, i) => [`gid-${i}`, h]));
  return {
    handleInput: () => 'unhandled',
    resolveOnly: () => null,
    resolveAll: () => [],
    explain: () => { throw new Error('explain is not stubbed'); },
    cancelAll: () => {},
    inFlightCursor: () => null,
  inFlight: () => map,
    getInFlightHandles: () => map.values(),
    subscribe: () => () => {},
    getVersion: () => 0,
    getActiveAction: () => ({ kind: null, id: null }),
    beginUiOngoing: () => null,
  };
}

/** The preview half of a view's draw envelope: what `useViewHelpers` puts
 *  there, that view's in-flight handles. */
function env(handles: readonly OngoingHandle[] = []) {
  return {
    getPreviewSources: (): readonly GesturePreviewSource[] => handles,
  };
}

/** Walk a DrawCommand tree and collect all leaf `kind: 'path'` rects. */
function collectRects(cmds: DrawCommand[]): Array<{ x: number; y: number }> {
  const out: Array<{ x: number; y: number }> = [];
  const visit = (cmd: DrawCommand) => {
    if (cmd.kind === 'group') {
      for (const child of (cmd as GroupDrawCommand).children) visit(child);
    } else if (cmd.kind === 'path' && cmd.path.kind === 'rect') {
      out.push({ x: cmd.path.x, y: cmd.path.y });
    }
  };
  for (const c of cmds) visit(c);
  return out;
}

describe('usePreviewGhostLayer — dispatcher in-flight handles', () => {
  it("renders a ghost for an OngoingHandle's previewIds/previewPose", () => {
    const scene = createScene<Data, 'main', Pose>({ systemLayers: [{ id: 'main' }] });
    const a = scene.add({ kind: 'mark', layer: 'main', pose: COMMITTED_POSE, data: { label: 'a' } });

    const handle: OngoingHandle = {
      previewIds: () => [a],
      previewPose: (id) => (id === a ? PREVIEW_POSE : null),
    };
    const dispatcher = makeDispatcher([handle]);

    const { result } = renderHook(() =>
      usePreviewGhostLayer<Data, 'main', Pose>({
        scene,
        sceneSlot: { drawOne },
        dispatcher,
      }),
    );

    const cmds = result.current.draw(env([handle]), VIEW, DIMS);
    const rects = collectRects(cmds);
    expect(rects).toHaveLength(1);
    expect(rects[0]).toEqual({ x: PREVIEW_POSE.x, y: PREVIEW_POSE.y });
  });

  it('removing the handle (commit/cancel) removes the ghost', () => {
    const scene = createScene<Data, 'main', Pose>({ systemLayers: [{ id: 'main' }] });
    const a = scene.add({ kind: 'mark', layer: 'main', pose: COMMITTED_POSE, data: { label: 'a' } });

    const handle: OngoingHandle = {
      previewIds: () => [a],
      previewPose: (id) => (id === a ? PREVIEW_POSE : null),
    };

    const { result } = renderHook(() =>
      usePreviewGhostLayer<Data, 'main', Pose>({
        scene,
        sceneSlot: { drawOne },
        dispatcher: makeDispatcher([handle]),
      }),
    );
    // Start: one handle in flight → ghost emitted.
    expect(collectRects(result.current.draw(env([handle]), VIEW, DIMS))).toHaveLength(1);
    // After commit: no in-flight handles → no ghost.
    expect(collectRects(result.current.draw(env(), VIEW, DIMS))).toHaveLength(0);
  });
});

describe('usePreviewGhostLayer — clips', () => {
  /** Each rect drawn, with whether any group above it clips. */
  function rectsUnderClips(cmds: DrawCommand[]): Array<{ x: number; clipped: boolean }> {
    const out: Array<{ x: number; clipped: boolean }> = [];
    const visit = (cmd: DrawCommand, clipped: boolean) => {
      if (cmd.kind === 'group') {
        const g = cmd as GroupDrawCommand;
        for (const child of g.children) visit(child, clipped || g.clip !== undefined);
      } else if (cmd.kind === 'path' && cmd.path.kind === 'rect') out.push({ x: cmd.path.x, clipped });
    };
    for (const c of cmds) visit(c, false);
    return out;
  }

  it('clips the children of a previewed node by its clip, and not its own paint', () => {
    const scene = createScene<Data, 'main', Pose>({ systemLayers: [{ id: 'main' }] });
    const p = scene.add({
      kind: 'mark', layer: 'main', pose: COMMITTED_POSE, data: { label: 'p' },
      clipFromPose: (pose) => ({ kind: 'rect', x: pose.x, y: pose.y, width: pose.width, height: pose.height }),
    });
    const k = scene.add({ kind: 'mark', layer: 'main', parent: p, pose: { x: 3, y: 0, width: 10, height: 10 }, data: { label: 'k' } });
    const handle: OngoingHandle = { previewIds: () => [p, k], previewPose: () => null };
    const { result } = renderHook(() =>
      usePreviewGhostLayer<Data, 'main', Pose>({ scene, sceneSlot: { drawOne }, dispatcher: makeDispatcher([handle]) }),
    );
    expect(rectsUnderClips(result.current.draw(env([handle]), VIEW, DIMS))).toEqual([
      { x: 0, clipped: false },
      { x: 3, clipped: true },
    ]);
  });
});

describe('usePreviewGhostLayer — previewOpaqueIds', () => {
  it('splits opaque ids out of the ghost alpha group', () => {
    const scene = createScene<Data, 'main', Pose>({ systemLayers: [{ id: 'main' }] });
    const dragged = scene.add({ kind: 'mark', layer: 'main', pose: COMMITTED_POSE, data: { label: 'd' } });
    const reflowed = scene.add({ kind: 'mark', layer: 'main', pose: COMMITTED_POSE, data: { label: 'r' } });

    const handle: OngoingHandle = {
      previewIds: () => [dragged, reflowed],
      previewPose: (id) => (id === dragged ? PREVIEW_POSE : { ...PREVIEW_POSE, x: 99 }),
      previewOpaqueIds: () => [reflowed],
    };

    const { result } = renderHook(() =>
      usePreviewGhostLayer<Data, 'main', Pose>({
        scene,
        sceneSlot: { drawOne },
        dispatcher: makeDispatcher([handle]),
      }),
    );

    const cmds = result.current.draw(env([handle]), VIEW, DIMS) as GroupDrawCommand[];
    const byAlpha = cmds.map((c) => [c.alpha, collectRects(c.children).map((r) => r.x)]);
    expect(byAlpha).toEqual([
      [undefined, [99]],
      [0.85, [PREVIEW_POSE.x]],
    ]);
  });

  it('emits only the ghost group when nothing is opaque', () => {
    const scene = createScene<Data, 'main', Pose>({ systemLayers: [{ id: 'main' }] });
    const a = scene.add({ kind: 'mark', layer: 'main', pose: COMMITTED_POSE, data: { label: 'a' } });

    const handle: OngoingHandle = {
      previewIds: () => [a],
      previewPose: () => PREVIEW_POSE,
      previewOpaqueIds: () => null,
    };

    const { result } = renderHook(() =>
      usePreviewGhostLayer<Data, 'main', Pose>({
        scene,
        sceneSlot: { drawOne },
        dispatcher: makeDispatcher([handle]),
      }),
    );

    const cmds = result.current.draw(env([handle]), VIEW, DIMS) as GroupDrawCommand[];
    expect(cmds.map((c) => c.alpha)).toEqual([0.85]);
  });
});

describe('usePreviewGhostLayer — a render React abandons', () => {
  it('ghosts through the committed scene and slot', () => {
    const scene = createScene<Data, 'main', Pose>({ systemLayers: [{ id: 'main' }] });
    const a = scene.add({ kind: 'mark', layer: 'main', pose: COMMITTED_POSE, data: { label: 'a' } });
    const other = createScene<Data, 'main', Pose>({ systemLayers: [{ id: 'main' }] });
    const handle: OngoingHandle = {
      previewIds: () => [a],
      previewPose: (id) => (id === a ? PREVIEW_POSE : null),
    };
    const dispatcher = makeDispatcher([handle]);
    const drawnB: unknown[] = [];
    const slotA = { drawOne };
    const slotB = { drawOne: (...args: Parameters<typeof drawOne>) => { drawnB.push(args); return drawOne(...args); } };
    let layer!: ReturnType<typeof usePreviewGhostLayer>;
    function Probe({ which }: { which: 'a' | 'b' }) {
      layer = usePreviewGhostLayer<Data, 'main', Pose>({
        scene: which === 'a' ? scene : other,
        sceneSlot: which === 'a' ? slotA : slotB,
        dispatcher,
      });
      return null;
    }
    renderThenAbandon<'a' | 'b'>('a', 'b', (which) => <Probe which={which} />);

    const rects = collectRects(layer.draw(env([handle]), VIEW, DIMS));
    expect(rects).toEqual([{ x: PREVIEW_POSE.x, y: PREVIEW_POSE.y }]);
    expect(drawnB).toEqual([]);
  });
});

describe('usePreviewGhostLayer — parallax layers', () => {
  /** Leaf rects as the camera's world sees them, through every group transform. */
  function rectsInCamera(cmds: DrawCommand[]): Array<{ x: number; y: number; width: number }> {
    const out: Array<{ x: number; y: number; width: number }> = [];
    const visit = (cmd: DrawCommand, s: number, tx: number, ty: number) => {
      if (cmd.kind === 'group') {
        const t = (cmd as GroupDrawCommand).transform;
        const [ns, nx, ny] = t ? [s * t[0], s * t[6] + tx, s * t[7] + ty] : [s, tx, ty];
        for (const child of (cmd as GroupDrawCommand).children) visit(child, ns, nx, ny);
      } else if (cmd.kind === 'path' && cmd.path.kind === 'rect') {
        out.push({ x: s * cmd.path.x + tx, y: s * cmd.path.y + ty, width: s * cmd.path.width });
      }
    };
    for (const c of cmds) visit(c, 1, 0, 0);
    return out;
  }

  it('ghosts a plane node where its plane draws it', () => {
    // The sky does not zoom; under a 2x camera its world is the camera's
    // doubled, so a sky rect at (100,200) 10 wide paints at camera (50,100) 5 wide.
    const scene = createScene<Data, 'sky', Pose>({ systemLayers: [{ id: 'sky', parallax: { pan: 1, zoom: 0 } }] });
    const a = scene.add({ kind: 'mark', layer: 'sky', pose: COMMITTED_POSE, data: { label: 'a' } });
    const handle: OngoingHandle = {
      previewIds: () => [a],
      previewPose: (id) => (id === a ? PREVIEW_POSE : null),
    };
    const views: View[] = [];
    const { result } = renderHook(() =>
      usePreviewGhostLayer<Data, 'sky', Pose>({
        scene,
        sceneSlot: { drawOne: (n, p, v) => { views.push(v); return drawOne(n as never, p, v); } },
        dispatcher: makeDispatcher([handle]),
      }),
    );
    const camera: View = { x: 0, y: 0, scale: { x: 2, y: 2 } };
    const cmds = result.current.draw(env([handle]), camera, DIMS);
    expect(rectsInCamera(cmds)).toEqual([{ x: 50, y: 100, width: 5 }]);
    expect(views[0]).toEqual({ x: 0, y: 0, scale: { x: 1, y: 1 } });
  });
});

describe('usePreviewGhostLayer — inherited paint', () => {
  it("paints a member's inherited fill from its container's previewed data", () => {
    const RED = { paint: { color: '#f00' } };
    const BLUE = { paint: { color: '#00f' } };
    const scene = createScene<{ fill?: unknown }, 'main', Pose>({ systemLayers: [{ id: 'main' }] });
    const g = scene.add({ kind: 'group', layer: 'main', pose: COMMITTED_POSE, data: { fill: RED } });
    const c = scene.add({ kind: 'mark', layer: 'main', parent: g, pose: COMMITTED_POSE, data: { fill: INHERIT } });
    const handle: OngoingHandle = {
      previewIds: () => [g, c],
      previewPose: () => null,
      previewData: (id) => (id === g ? { fill: BLUE } : null),
    };
    const seen = new Map<string, unknown>();
    const record = (n: { id: string }, _p: Pose, _v: View, ctx?: NodePaintCtx): DrawCommand[] => {
      seen.set(n.id, ctx?.inherited?.fill);
      return [];
    };
    const { result } = renderHook(() =>
      usePreviewGhostLayer<{ fill?: unknown }, 'main', Pose>({
        scene,
        sceneSlot: { drawOne: withInheritedPaints(scene, record) },
        dispatcher: makeDispatcher([handle]),
      }),
    );
    result.current.draw(env([handle]), VIEW, DIMS);
    expect(seen.get(c)).toBe(BLUE);
  });
});
