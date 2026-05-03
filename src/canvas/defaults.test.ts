import { describe, expect, it } from 'vitest';
import { defaultLayers } from './defaults';
import type { MoveOverlay } from '../interactions/gestures/types';

interface Rect { id: string; x: number; y: number; width: number; height: number }
interface Pose { x: number; y: number; width: number; height: number }

const RECTS: Rect[] = [
  { id: 'a', x: 0, y: 0, width: 10, height: 10 },
  { id: 'b', x: 20, y: 0, width: 10, height: 10 },
];

const drawOne = () => {};

describe('defaultLayers', () => {
  it('returns just the scene layer for a minimal config', () => {
    const layers = defaultLayers<Rect, Pose>({
      scene: { objects: RECTS, drawOne },
    });
    expect(layers.map((l) => l.id)).toEqual(['scene']);
  });

  it('orders background → grid → scene → move-ghost → additional → selection', () => {
    const overlay: MoveOverlay<Pose> = {
      draggedIds: ['a'],
      poses: new Map([['a', { x: 5, y: 5, width: 10, height: 10 }]]),
      snapped: null,
      hideIds: ['a'],
    };
    const layers = defaultLayers<Rect, Pose>({
      background: '#000',
      backgroundBounds: () => ({ x: 0, y: 0, width: 100, height: 100 }),
      grid: { spacing: 10, bounds: () => ({ x: 0, y: 0, width: 100, height: 100 }) },
      scene: { objects: RECTS, drawOne },
      moveOverlay: overlay,
      additional: [{ id: 'custom', label: 'Custom', draw: () => {} }],
      selection: {
        ids: ['a'],
        poseById: () => ({ x: 0, y: 0, width: 10, height: 10 }),
      },
    });
    expect(layers.map((l) => l.id)).toEqual([
      'background',
      'grid',
      'scene',
      'move-ghost',
      'custom',
      'selection-overlay',
    ]);
  });

  it('scene layer skips hideIds and folds overlay poses', () => {
    const overlay: MoveOverlay<Pose> = {
      draggedIds: ['a'],
      poses: new Map([['a', { x: 100, y: 100, width: 10, height: 10 }]]),
      snapped: null,
      hideIds: ['a'],
    };
    const drawn: Array<{ id: string; pose: Pose }> = [];
    const layers = defaultLayers<Rect, Pose>({
      scene: {
        objects: RECTS,
        drawOne: (_ctx, obj, pose) => drawn.push({ id: obj.id, pose }),
      },
      moveOverlay: overlay,
    });
    const sceneLayer = layers.find((l) => l.id === 'scene')!;
    sceneLayer.draw({ canvas: { width: 100, height: 100 } } as unknown as CanvasRenderingContext2D, undefined);
    // 'a' is hidden, only 'b' should be drawn.
    expect(drawn).toEqual([{ id: 'b', pose: RECTS[1] }]);
  });

  it('scene layer folds overlay poses when not in hideIds', () => {
    const overlay: MoveOverlay<Pose> = {
      draggedIds: ['a'],
      poses: new Map([['a', { x: 99, y: 99, width: 10, height: 10 }]]),
      snapped: null,
      hideIds: [],
    };
    const drawn: Array<{ id: string; pose: Pose }> = [];
    const layers = defaultLayers<Rect, Pose>({
      scene: {
        objects: [RECTS[0]],
        drawOne: (_ctx, obj, pose) => drawn.push({ id: obj.id, pose }),
      },
      moveOverlay: overlay,
    });
    const sceneLayer = layers.find((l) => l.id === 'scene')!;
    sceneLayer.draw({ canvas: { width: 100, height: 100 } } as unknown as CanvasRenderingContext2D, undefined);
    expect(drawn[0].pose.x).toBe(99);
  });
});
