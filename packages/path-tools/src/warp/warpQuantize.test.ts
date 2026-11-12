/**
 * A warp's control drag under a scene's quantize rule previews the shape the
 * rule stores, so the release lands where the preview showed.
 */
import { describe, expect, it } from 'vitest';
import { PathBuilder, type OutputGrid } from '@weasel-js/geom';
import type { InvocationCtx, OngoingInvoker } from '@weasel-js/routing';
import { asNodeId, createScene, OUTPUT_GRID_KEY, type RectPose, type Scene } from '@weasel-js/core';
import { createWarpDragAction } from './warpActions';

const GRID: OutputGrid = { pitch: 1, origin: { x: 0, y: 0 } };
const round = (p: RectPose): RectPose => ({ ...p, x: Math.round(p.x), y: Math.round(p.y), width: Math.round(p.width), height: Math.round(p.height) });

describe('a warp drag under a quantize rule', () => {
  it('previews the shape it commits', () => {
    const path = new PathBuilder().moveTo(0, 0).lineTo(100, 0).lineTo(100, 100).lineTo(0, 100).close().build();
    const scene = createScene<unknown, 'main', RectPose>({
      systemLayers: [{ id: 'main' }],
      quantize: { stored: ({ pose }) => ({ pose: round(pose) }) },
      doc: { [OUTPUT_GRID_KEY]: GRID },
      initial: [{ id: asNodeId('a'), kind: 'mark', layer: 'main', pose: { x: 0, y: 0, width: 100, height: 100 }, data: { path } }],
    }) as unknown as Scene<unknown, string, unknown>;
    const from = { x: 100, y: 100 };
    const ctx = (at: { x: number; y: number }): InvocationCtx => ({
      world: at,
      modifiers: { alt: false, ctrl: false, meta: false, shift: false },
      deps: { scene, selection: { get: () => ['a'], set: () => {}, clear: () => {} } } as unknown as InvocationCtx['deps'],
      drag: {
        start: from, current: at, delta: { x: at.x - from.x, y: at.y - from.y },
        affordance: { kind: 'layer:warp-distort', payload: { warpId: null, index: 2 } },
      },
    });
    const handle = (createWarpDragAction('distort').invoker as OngoingInvoker).start(ctx(from), { params: {} });
    const to = { x: 120.37, y: 110.41 };
    handle.onMove!(ctx(to));
    const pose = handle.previewPose!('a');
    handle.onEnd!(ctx(to), 'commit');
    expect(pose).toBeTruthy();
    expect(scene.get(asNodeId('a'))!.pose).toEqual(pose);
  });
});
