/**
 * `geometry.picking: 'pixels'` against a fake id frame: which nodes a pick
 * finds, in what order, and when it falls back to the shape walk. The real
 * frames are `pickAt.browser.test.tsx`'s.
 */
import { describe, it, expect } from 'vitest';
import { renderHook } from '@testing-library/react';
import type { IdBuffer } from '@weasel-js/renderer';
import { useScene } from 'core/scene/useScene';
import { asNodeId, type Scene, type UseSceneOptions } from 'core/scene/types';
import { useSceneAdapter } from 'canvas/useSceneAdapter';
import { scenePickIds } from 'canvas/scenePickIds';
import type { CanvasIdReadOptions } from 'canvas/canvasExtension';
import { useSceneSelectTool, type PickView } from './useSceneSelectTool';

type Pose = { x: number; y: number; width: number; height: number };
type Rect = { x: number; y: number; width: number; height: number };

const NODES: UseSceneOptions<object, 'default' | 'notes', Pose>['initial'] = [
  { id: asNodeId('back'), kind: 'mark', layer: 'default', pose: { x: 0, y: 0, width: 100, height: 100 }, data: {} },
  { id: asNodeId('front'), kind: 'mark', layer: 'default', pose: { x: 0, y: 0, width: 100, height: 100 }, data: {} },
  { id: asNodeId('aside'), kind: 'mark', layer: 'default', pose: { x: 200, y: 200, width: 10, height: 10 }, data: {} },
];

/**
 * An id frame where `paint` names, per node, the screen rect it covers, drawn
 * in the order given (so later entries are on top). One id per CSS pixel.
 */
function fakeFrame(scene: Scene<object, 'default' | 'notes', Pose>, paint: [string, Rect][], log: Rect[] = []) {
  const ids = scenePickIds(scene);
  return (rect: Rect, options?: CanvasIdReadOptions): IdBuffer => {
    log.push(rect);
    const x0 = Math.floor(rect.x);
    const y0 = Math.floor(rect.y);
    const width = Math.max(1, Math.ceil(rect.x + rect.width) - x0);
    const height = Math.max(1, Math.ceil(rect.y + rect.height) - y0);
    const data = new Uint32Array(width * height);
    for (const [id, r] of paint) {
      const pick = ids.idOf(id);
      if (options?.exclude?.has(pick)) continue;
      for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
          const px = x0 + x;
          const py = y0 + y;
          if (px >= r.x && px < r.x + r.width && py >= r.y && py < r.y + r.height) data[y * width + x] = pick;
        }
      }
    }
    return { x: x0, y: y0, width, height, data };
  };
}

const EMPTY: IdBuffer = { x: 0, y: 0, width: 0, height: 0, data: new Uint32Array(0) };

function harness(opts: {
  paint?: [string, Rect][];
  noFrame?: boolean;
  /** The canvas reads ids only asynchronously (WebGPU). */
  asyncOnly?: boolean;
  view?: { x: number; y: number; scale: { x: number; y: number } };
  tolerance?: number;
  interactive?: (id: string) => boolean;
  log?: Rect[];
  /** Fields laid over `front`. */
  front?: { locked?: boolean; pickable?: boolean; layer?: 'default' | 'notes' };
}) {
  const view = opts.view ?? { x: 0, y: 0, scale: { x: 1, y: 1 } };
  const { result } = renderHook(() => {
    const initial = opts.front ? NODES!.map((n) => (n.id === 'front' ? { ...n, ...opts.front } : n)) : NODES;
    const scene = useScene<object, 'default' | 'notes', Pose>({
      systemLayers: [{ id: 'default' }, { id: 'notes', annotation: true }], initial,
    });
    const adapter = useSceneAdapter(scene);
    const read = opts.asyncOnly ? () => null : opts.noFrame ? () => EMPTY : fakeFrame(scene, opts.paint ?? [], opts.log);
    return useSceneSelectTool({
      scene, adapter,
      geometry: { picking: 'pixels', pickTolerancePx: opts.tolerance ?? 0 },
      getView: () => view,
      readIds: () => read,
      ...(opts.interactive ? { isPointerInteractive: opts.interactive } : {}),
    });
  });
  return (x: number, y: number, asked?: PickView) => result.current.pickEvery({ x, y }, asked);
}

describe("useSceneSelectTool, geometry.picking: 'pixels'", () => {
  it('finds what was painted at the point, not what the poses cover', () => {
    // Both poses cover (50, 50); only `back` painted there.
    const pick = harness({ paint: [['back', { x: 0, y: 0, width: 100, height: 100 }], ['front', { x: 0, y: 0, width: 10, height: 10 }]] });
    expect(pick(50, 50)).toEqual(['back']);
    expect(pick(5, 5)).toEqual(['back', 'front']);
    expect(pick(150, 150)).toEqual([]);
  });

  it('finds a node covered by another, back-to-front, so an exclude can see beneath', () => {
    const pick = harness({ paint: [['back', { x: 0, y: 0, width: 100, height: 100 }], ['front', { x: 0, y: 0, width: 100, height: 100 }]] });
    expect(pick(50, 50)).toEqual(['back', 'front']);
  });

  it('reads the surface camera\'s screen point, with the tolerance around it', () => {
    const log: Rect[] = [];
    const pick = harness({
      paint: [['aside', { x: 400, y: 400, width: 20, height: 20 }]],
      view: { x: 0, y: 0, scale: { x: 2, y: 2 } }, tolerance: 3, log,
    });
    expect(pick(205, 205)).toEqual(['aside']);
    expect(log[0]).toEqual({ x: 407, y: 407, width: 6, height: 6 });
    // Three screen pixels short of its paint still reaches it.
    expect(pick(199, 199)).toEqual(['aside']);
    expect(pick(197, 197)).toEqual([]);
  });

  it('leaves out what isPointerInteractive rejects', () => {
    const pick = harness({
      paint: [['back', { x: 0, y: 0, width: 100, height: 100 }], ['front', { x: 0, y: 0, width: 100, height: 100 }]],
      interactive: (id) => id !== 'front',
    });
    expect(pick(50, 50)).toEqual(['back']);
  });

  it('passes over a locked node and one that is not pickable, as the shape walk does', () => {
    const paint: [string, Rect][] = [['back', { x: 0, y: 0, width: 100, height: 100 }], ['front', { x: 0, y: 0, width: 100, height: 100 }]];
    expect(harness({ paint, front: { locked: true } })(50, 50)).toEqual(['back']);
    expect(harness({ paint, front: { pickable: false } })(50, 50)).toEqual(['back']);
  });

  it('passes through a node on an annotation layer, as the shape walk does', () => {
    const paint: [string, Rect][] = [['back', { x: 0, y: 0, width: 100, height: 100 }], ['front', { x: 0, y: 0, width: 100, height: 100 }]];
    expect(harness({ paint, front: { layer: 'notes' } })(50, 50)).toEqual(['back']);
    expect(harness({ noFrame: true, front: { layer: 'notes' } })(50, 50)).toEqual(['back']);
  });

  it('falls back to the shape walk with no painted frame', () => {
    const pick = harness({ noFrame: true });
    expect(pick(50, 50)).toEqual(['back', 'front']);
  });

  it('falls back to the shape walk where ids cannot be read at once', () => {
    const pick = harness({ asyncOnly: true });
    expect(pick(50, 50)).toEqual(['back', 'front']);
  });

  it('falls back to the shape walk for a view other than the surface\'s', () => {
    const pick = harness({ paint: [] });
    expect(pick(50, 50)).toEqual([]);
    expect(pick(50, 50, { scale: { x: 1, y: 1 }, layerIsPainted: () => true })).toEqual(['back', 'front']);
    expect(pick(50, 50, { scale: { x: 3, y: 3 } })).toEqual(['back', 'front']);
    expect(pick(50, 50, { scale: { x: 1, y: 1 }, x: 0, y: 0 })).toEqual([]);
  });

  it('draws one frame past the last node it finds', () => {
    const log: Rect[] = [];
    const pick = harness({ paint: [['back', { x: 0, y: 0, width: 100, height: 100 }]], log });
    pick(50, 50);
    // One frame finds `back`, the next finds nothing new.
    expect(log).toHaveLength(2);
  });
});
