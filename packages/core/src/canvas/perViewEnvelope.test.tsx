/**
 * One layer instance, two draw envelopes — the shape that catches a layer
 * answering for the surface's view in every view.
 *
 * `<CanvasView>` draws the surface's layer array unchanged and differs only in
 * the envelope it passes, so a layer that reads its state from a construction
 * closure paints view zero's answer into every panel.
 */
import { describe, it, expect } from 'vitest';
import { renderHook } from '@testing-library/react';
import { createScene } from 'core/scene/scene';
import type { View } from 'core/viewport/view';
import type { DrawCommand, GroupDrawCommand } from '../renderer';
import type { Node } from 'core/scene/types';
import type { OngoingOverlay } from 'interactions/actions/invoker';
import type { ChromeState } from 'core/selection/chromeState';
import type { GesturePreviewSource } from './gestureBounds';
import { usePreviewGhostLayer } from './SceneCanvas/usePreviewGhostLayer';
import { useDispatcherOverlayLayer } from './SceneCanvas/useDispatcherOverlayLayer';
import { createPathEditingOverlayLayer } from 'features/paths/pathEditingOverlayLayer';
import { createSlopsDebugLayer } from './slopsDebugLayer';
import { polygonFromPoints } from 'features/paths/builder';
import type { PolygonPath } from 'features/paths/types';
import { asNodeId } from 'core/scene/types';

interface Data { label: string }
interface Pose { x: number; y: number; width: number; height: number }

const VIEW: View = { x: 0, y: 0, scale: { x: 1, y: 1 } };
const DIMS = { width: 800, height: 600 };

function drawOne(_node: Node<Data, 'main', Pose>, pose: Pose): DrawCommand[] {
  return [{
    kind: 'path',
    path: { kind: 'rect', x: pose.x, y: pose.y, width: pose.width, height: pose.height },
    fill: { color: '#000' },
  }];
}

/** The half of a draw envelope these layers read. */
function envelope(parts: {
  previewSources?: readonly GesturePreviewSource[];
  overlays?: readonly OngoingOverlay[];
  chromeState?: ChromeState;
  isVisible?: (id: string) => boolean;
}) {
  return {
    getPreviewSources: () => parts.previewSources ?? [],
    getGestureOverlays: () => parts.overlays ?? [],
    getChromeState: () => parts.chromeState ?? {
      selection: [], multiActive: false, boundsOf: () => null, unionBounds: null,
      modifiers: { alt: false, shift: false, meta: false, ctrl: false },
    } as ChromeState,
    getIsVisible: () => parts.isVisible ?? (() => true),
  };
}

function collectRects(cmds: DrawCommand[]): Array<{ x: number; y: number }> {
  const out: Array<{ x: number; y: number }> = [];
  const visit = (cmd: DrawCommand): void => {
    if (cmd.kind === 'group') {
      for (const child of (cmd as GroupDrawCommand).children) visit(child);
    } else if (cmd.kind === 'path' && cmd.path.kind === 'rect') {
      out.push({ x: cmd.path.x, y: cmd.path.y });
    }
  };
  for (const c of cmds) visit(c);
  return out;
}

describe('preview-ghost layer answers for the view it is drawn for', () => {
  it('ghosts view A\'s drag in A and view B\'s in B', () => {
    const scene = createScene<Data, 'main', Pose>({ systemLayers: [{ id: 'main' }] });
    const a = scene.add({ kind: 'leaf', layer: 'main', pose: { x: 0, y: 0, width: 10, height: 10 }, data: { label: 'a' } });

    const inA: GesturePreviewSource = {
      previewIds: () => [a],
      previewPose: (id) => (id === a ? { x: 100, y: 200, width: 10, height: 10 } : null),
    };
    const inB: GesturePreviewSource = {
      previewIds: () => [a],
      previewPose: (id) => (id === a ? { x: 300, y: 400, width: 10, height: 10 } : null),
    };

    const { result } = renderHook(() =>
      usePreviewGhostLayer<Data, 'main', Pose>({ scene, sceneSlot: { drawOne } }),
    );
    const layer = result.current;

    expect(collectRects(layer.draw(envelope({ previewSources: [inA] }), VIEW, DIMS)))
      .toEqual([{ x: 100, y: 200 }]);
    expect(collectRects(layer.draw(envelope({ previewSources: [inB] }), VIEW, DIMS)))
      .toEqual([{ x: 300, y: 400 }]);
    expect(collectRects(layer.draw(envelope({}), VIEW, DIMS))).toEqual([]);
  });
});

describe('dispatcher-overlay layer answers for the view it is drawn for', () => {
  it('paints each view\'s own marquee', () => {
    const { result } = renderHook(() => useDispatcherOverlayLayer({ dispatcher: null }));
    const layer = result.current;

    const marquee = (x: number): OngoingOverlay => ({
      kind: 'marquee',
      start: { x, y: 0 },
      current: { x: x + 10, y: 10 },
      shiftHeld: false,
    });

    expect(collectRects(layer.draw(envelope({ overlays: [marquee(5)] }), VIEW, DIMS)))
      .toEqual([{ x: 5, y: 0 }]);
    expect(collectRects(layer.draw(envelope({ overlays: [marquee(70)] }), VIEW, DIMS)))
      .toEqual([{ x: 70, y: 0 }]);
    expect(layer.draw(envelope({}), VIEW, DIMS)).toEqual([]);
  });
});

/** Min x across every polygon vertex a layer emitted. */
function minX(cmds: DrawCommand[]): number {
  let min = Infinity;
  for (const c of cmds) {
    if (c.kind !== 'path' || c.path.kind !== 'polygon') continue;
    const { coords } = c.path;
    for (let i = 0; i < coords.length; i += 2) min = Math.min(min, coords[i]!);
  }
  return min;
}

describe('path-editing overlay resolves its path through the drawn view', () => {
  it('follows each view\'s own in-flight anchor drag', () => {
    const committed = polygonFromPoints([{ x: 0, y: 0 }, { x: 10, y: 0 }]);
    const layer = createPathEditingOverlayLayer({
      getEditingId: () => 'p',
      getPose: (id, previews) => {
        for (const s of previews) {
          const p = s.previewPose?.(id) as PolygonPath | null | undefined;
          if (p != null) return p;
        }
        return committed;
      },
    });

    const dragTo = (x: number): GesturePreviewSource => ({
      previewIds: () => ['p'],
      previewPose: () => polygonFromPoints([{ x, y: 0 }, { x: 10, y: 0 }]),
    });

    const a = minX(layer.draw(envelope({ previewSources: [dragTo(50)] }), VIEW, DIMS));
    const b = minX(layer.draw(envelope({ previewSources: [dragTo(-50)] }), VIEW, DIMS));
    expect(a).toBeGreaterThan(b);
    // …and the committed path when nothing is in flight for this view.
    expect(minX(layer.draw(envelope({}), VIEW, DIMS))).toBeCloseTo(-4);
  });
});

describe('slops-debug overlay answers for the view it is drawn for', () => {
  it('halos each view\'s own selection at that view\'s bounds', () => {
    const layer = createSlopsDebugLayer({ getEditingId: () => null, getPose: () => null });

    const chrome = (x: number, ids: string[]): ChromeState => ({
      selection: ids.map(asNodeId),
      multiActive: false,
      boundsOf: () => ({ x, y: 0, width: 10, height: 10 }),
      unionBounds: null,
      modifiers: { alt: false, shift: false, meta: false, ctrl: false },
    });

    const a = layer.draw(envelope({ chromeState: chrome(0, ['n1']) }), VIEW, DIMS);
    const b = layer.draw(envelope({ chromeState: chrome(500, ['n1']) }), VIEW, DIMS);
    expect(a.length).toBeGreaterThan(0);
    expect(minX(a)).not.toEqual(minX(b));
    expect(layer.draw(envelope({ chromeState: chrome(0, []) }), VIEW, DIMS)).toEqual([]);
  });
});
