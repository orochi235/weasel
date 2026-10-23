/**
 * Align, distribute, flip, and rotate measure a stroked shape by the box it is
 * drawn with, and by its pose box under `boundsIncludeStroke: false`.
 */
import { describe, it, expect } from 'vitest';
import type { ImmediateInvoker } from '@weasel-js/routing';
import { createScene } from 'core/scene/scene';
import { asNodeId, type NodeId, type RectPose, type Scene } from 'core/scene/types';
import { stubDeps } from './testUtils';
import { alignLeftAction } from './align/action';
import { distributeHorizontalAction } from './distribute/action';
import { flipAction } from './flip/action';
import { captureTurn } from './rotate/session';

const STROKE = { paint: { kind: 'solid', color: '#000' }, width: 20 } as const;

function makeScene(nodes: Record<string, { pose: RectPose; stroke?: boolean }>) {
  const scene = createScene<unknown, 'main', RectPose>({ systemLayers: [{ id: 'main' }] });
  for (const [id, n] of Object.entries(nodes)) {
    scene.add({
      id: asNodeId(id), kind: 'mark', layer: 'main', pose: n.pose,
      data: { shape: 'rect', ...(n.stroke ? { stroke: STROKE } : {}) },
    });
  }
  return scene as unknown as Scene<unknown, string, unknown>;
}

function run(action: { invoker?: unknown }, scene: Scene<unknown, string, unknown>, ids: string[], params?: Record<string, unknown>, extra: Record<string, unknown> = {}) {
  (action.invoker as ImmediateInvoker).run(stubDeps({
    scene, selection: { get: () => ids.map(asNodeId), adapterMethods: undefined }, ...extra,
  }), params);
}

const x = (scene: Scene<unknown, string, unknown>, id: string) => (scene.get(asNodeId(id))!.pose as RectPose).x;

describe('stroke-inclusive boxes', () => {
  it('align lines up the drawn left edges', () => {
    const scene = makeScene({
      a: { pose: { x: 0, y: 0, width: 50, height: 50 }, stroke: true },
      b: { pose: { x: 100, y: 0, width: 50, height: 50 } },
    });
    run(alignLeftAction, scene, ['a', 'b']);
    // `a` draws from -10, so `b` moves there.
    expect(x(scene, 'b')).toBe(-10);
    expect(x(scene, 'a')).toBe(0);
  });

  it('align lines up the pose boxes when the canvas opts out', () => {
    const scene = makeScene({
      a: { pose: { x: 0, y: 0, width: 50, height: 50 }, stroke: true },
      b: { pose: { x: 100, y: 0, width: 50, height: 50 } },
    });
    run(alignLeftAction, scene, ['a', 'b'], undefined, { boundsIncludeStroke: false });
    expect(x(scene, 'b')).toBe(0);
  });

  it('distribute spaces the drawn boxes evenly', () => {
    const scene = makeScene({
      a: { pose: { x: 0, y: 0, width: 50, height: 50 }, stroke: true },
      b: { pose: { x: 70, y: 0, width: 50, height: 50 } },
      c: { pose: { x: 300, y: 0, width: 50, height: 50 } },
    });
    run(distributeHorizontalAction, scene, ['a', 'b', 'c'], { mode: 'gaps' });
    // Drawn widths 70, 50, 50 over -10..350 leave two gaps of 95.
    expect(x(scene, 'b')).toBe(155);
  });

  it('flip about the union mirrors across the drawn union', () => {
    const scene = makeScene({
      a: { pose: { x: 0, y: 0, width: 50, height: 50 }, stroke: true },
      b: { pose: { x: 100, y: 0, width: 50, height: 50 } },
    });
    run(flipAction, scene, ['a', 'b'], { axis: 'x', pivot: 'union' });
    // Drawn union -10..150, center 70: `b` (100..150) lands on -10..40.
    expect(x(scene, 'b')).toBe(-10);
  });

  it('rotate turns a selection about the center of its drawn union', () => {
    const scene = makeScene({
      a: { pose: { x: 0, y: 0, width: 50, height: 50 }, stroke: true },
      b: { pose: { x: 100, y: 0, width: 50, height: 50 } },
    });
    const t = captureTurn(scene, [asNodeId('a'), asNodeId('b')] as NodeId[], {}, 'union');
    expect(t!.turn.pivot).toEqual({ x: 70, y: 25 });
  });
});
