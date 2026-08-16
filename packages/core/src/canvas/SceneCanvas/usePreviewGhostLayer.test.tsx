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
import type { DrawCommand, GroupDrawCommand } from '../../renderer';
import type { Node } from 'core/scene/types';
import type { ToolsApi } from 'tools/useTools';
import type { Dispatcher } from 'interactions/dispatcher/dispatcher';
import type { OngoingHandle } from 'interactions/actions/invoker';
import { usePreviewGhostLayer } from './usePreviewGhostLayer';

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
    fill: { color: '#000' },
  }];
}

function makeToolsApi(): ToolsApi {
  // The preview-ghost layer only reads .registry, .ambient, .active,
  // .hotkeyEngaged from ToolsApi. Stub everything else as no-op.
  return {
    active: 'noop',
    setActive: () => {},
    hotkeyEngaged: null,
    engageHotkey: () => {},
    disengageHotkey: () => {},
    ambient: [],
    registry: {},
    has: () => false,
    getActiveOverlays: () => [],
  };
}

/** Minimal Dispatcher stub exposing only what the preview layer reads. */
function makeDispatcher(handles: OngoingHandle[]): Dispatcher {
  const map = new Map<string, OngoingHandle>(handles.map((h, i) => [`gid-${i}`, h]));
  return {
    handleInput: () => 'unhandled',
    resolveOnly: () => null,
    resolveAll: () => [],
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
    const a = scene.add({ kind: 'leaf', layer: 'main', pose: COMMITTED_POSE, data: { label: 'a' } });

    const handle: OngoingHandle = {
      previewIds: () => [a],
      previewPose: (id) => (id === a ? PREVIEW_POSE : null),
    };
    const dispatcher = makeDispatcher([handle]);
    const tools = makeToolsApi();

    const { result } = renderHook(() =>
      usePreviewGhostLayer<Data, 'main', Pose>({
        scene,
        tools,
        sceneSlot: { drawOne },
        dispatcher,
      }),
    );

    const cmds = result.current.draw(undefined, VIEW, DIMS);
    const rects = collectRects(cmds);
    expect(rects).toHaveLength(1);
    expect(rects[0]).toEqual({ x: PREVIEW_POSE.x, y: PREVIEW_POSE.y });
  });

  it('removing the handle (commit/cancel) removes the ghost', () => {
    const scene = createScene<Data, 'main', Pose>({ systemLayers: [{ id: 'main' }] });
    const a = scene.add({ kind: 'leaf', layer: 'main', pose: COMMITTED_POSE, data: { label: 'a' } });

    const handle: OngoingHandle = {
      previewIds: () => [a],
      previewPose: (id) => (id === a ? PREVIEW_POSE : null),
    };
    const tools = makeToolsApi();

    // Start: one handle in flight → ghost emitted.
    const { result: r1 } = renderHook(() =>
      usePreviewGhostLayer<Data, 'main', Pose>({
        scene,
        tools,
        sceneSlot: { drawOne },
        dispatcher: makeDispatcher([handle]),
      }),
    );
    expect(collectRects(r1.current.draw(undefined, VIEW, DIMS))).toHaveLength(1);

    // After commit: dispatcher reports no in-flight handles → no ghost.
    const { result: r2 } = renderHook(() =>
      usePreviewGhostLayer<Data, 'main', Pose>({
        scene,
        tools,
        sceneSlot: { drawOne },
        dispatcher: makeDispatcher([]),
      }),
    );
    expect(collectRects(r2.current.draw(undefined, VIEW, DIMS))).toHaveLength(0);
  });

  it('tool-side preview takes priority over dispatcher-side on overlapping id', () => {
    const scene = createScene<Data, 'main', Pose>({ systemLayers: [{ id: 'main' }] });
    const a = scene.add({ kind: 'leaf', layer: 'main', pose: COMMITTED_POSE, data: { label: 'a' } });

    const TOOL_POSE: Pose = { x: 50, y: 60, width: 10, height: 10 };
    const tools = makeToolsApi();
    const fakeTool = {
      id: 'noop',
      bindings: [],
      previewIds: () => [a],
      previewPose: (id: string) => (id === a ? TOOL_POSE : null),
    } as unknown as ToolsApi['registry'][string];
    // Mutate the registry record through an unknown cast — ToolsApi types it
    // as Readonly, but the test fixture needs to plant a fake tool.
    (tools as unknown as { registry: Record<string, typeof fakeTool> }).registry['noop'] = fakeTool;

    const handle: OngoingHandle = {
      previewIds: () => [a],
      previewPose: (id) => (id === a ? PREVIEW_POSE : null),
    };
    const dispatcher = makeDispatcher([handle]);

    const { result } = renderHook(() =>
      usePreviewGhostLayer<Data, 'main', Pose>({
        scene,
        tools,
        sceneSlot: { drawOne },
        dispatcher,
      }),
    );

    const rects = collectRects(result.current.draw(undefined, VIEW, DIMS));
    expect(rects).toHaveLength(1);
    expect(rects[0]).toEqual({ x: TOOL_POSE.x, y: TOOL_POSE.y });
  });
});

describe('usePreviewGhostLayer — previewOpaqueIds', () => {
  it('splits opaque ids out of the ghost alpha group', () => {
    const scene = createScene<Data, 'main', Pose>({ systemLayers: [{ id: 'main' }] });
    const dragged = scene.add({ kind: 'leaf', layer: 'main', pose: COMMITTED_POSE, data: { label: 'd' } });
    const reflowed = scene.add({ kind: 'leaf', layer: 'main', pose: COMMITTED_POSE, data: { label: 'r' } });

    const handle: OngoingHandle = {
      previewIds: () => [dragged, reflowed],
      previewPose: (id) => (id === dragged ? PREVIEW_POSE : { ...PREVIEW_POSE, x: 99 }),
      previewOpaqueIds: () => [reflowed],
    };

    const { result } = renderHook(() =>
      usePreviewGhostLayer<Data, 'main', Pose>({
        scene,
        tools: makeToolsApi(),
        sceneSlot: { drawOne },
        dispatcher: makeDispatcher([handle]),
      }),
    );

    const cmds = result.current.draw(undefined, VIEW, DIMS) as GroupDrawCommand[];
    const byAlpha = cmds.map((c) => [c.alpha, collectRects(c.children).map((r) => r.x)]);
    expect(byAlpha).toEqual([
      [undefined, [99]],
      [0.85, [PREVIEW_POSE.x]],
    ]);
  });

  it('emits only the ghost group when nothing is opaque', () => {
    const scene = createScene<Data, 'main', Pose>({ systemLayers: [{ id: 'main' }] });
    const a = scene.add({ kind: 'leaf', layer: 'main', pose: COMMITTED_POSE, data: { label: 'a' } });

    const handle: OngoingHandle = {
      previewIds: () => [a],
      previewPose: () => PREVIEW_POSE,
      previewOpaqueIds: () => null,
    };

    const { result } = renderHook(() =>
      usePreviewGhostLayer<Data, 'main', Pose>({
        scene,
        tools: makeToolsApi(),
        sceneSlot: { drawOne },
        dispatcher: makeDispatcher([handle]),
      }),
    );

    const cmds = result.current.draw(undefined, VIEW, DIMS) as GroupDrawCommand[];
    expect(cmds.map((c) => c.alpha)).toEqual([0.85]);
  });
});
