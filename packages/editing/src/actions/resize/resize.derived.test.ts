/**
 * Resizing and rotating a node whose pose derives from the nodes it names: a
 * tween between a star and a turned box. Its handles sit on its own box, the
 * bounds of its steps, which is not the union of its sources.
 */
import { describe, expect, it } from 'vitest';
import type { InvocationCtx, OngoingHandle, OngoingInvoker } from '@weasel-js/routing';
import {
  asNodeId, createScene, effectivePose, PATH_EFFECT_DERIVATIONS, pathEffectNode, pathNode, withPathEffectsRegistry,
  type NodeId, type RectPose, type Scene,
} from '@weasel-js/core';
import { resizeAction } from './action';
import { rotateAction } from '../rotate/action';

const TWEEN = asNodeId('tween');
const FROM = asNodeId('from');
const KEYS = { alt: false, ctrl: false, meta: false, shift: false };

/** The tween lab's scene: a star, a box turned 45°, and five steps between them. */
function makeScene(): Scene<unknown, string, unknown> {
  const from = pathNode('from', 'M120 90 L138 136 L188 140 L150 172 L162 222 L120 194 L78 222 L90 172 L52 140 L102 136 Z', {});
  const to = pathNode('to', 'M440 110 L540 110 L540 250 L440 250 Z', {}, { rotation: Math.PI / 4 });
  const tween = { ...pathEffectNode({ kind: 'tween', steps: 5 }, [from.id, to.id], 'default', PATH_EFFECT_DERIVATIONS), id: TWEEN };
  return createScene<unknown, 'default', RectPose>({
    systemLayers: [{ id: 'default' }],
    registry: withPathEffectsRegistry(),
    initial: [from, tween, to],
  }) as unknown as Scene<unknown, string, unknown>;
}

const boxOf = (scene: Scene<unknown, string, unknown>, id: NodeId) => effectivePose(scene, scene.get(id)!) as RectPose;
const centerOf = (b: RectPose) => ({ x: b.x + b.width / 2, y: b.y + b.height / 2 });

function ctxAt(scene: Scene<unknown, string, unknown>, start: { x: number; y: number }, to: { x: number; y: number }): InvocationCtx {
  return {
    world: to,
    screen: to,
    modifiers: KEYS,
    deps: { operands: { get: () => [TWEEN] as NodeId[] }, scene },
    drag: {
      start, current: to, delta: { x: to.x - start.x, y: to.y - start.y },
      affordance: { kind: 'handle:bottom-right', targetIds: [TWEEN as string], anchor: { x: 'min', y: 'min' } },
    },
  } as unknown as InvocationCtx;
}

describe('resizing a node whose pose derives from its sources', () => {
  it('keeps the corner opposite the dragged handle fixed, and grows steadily, move after move', () => {
    const scene = makeScene();
    const start = boxOf(scene, TWEEN);
    const corner = { x: start.x + start.width, y: start.y + start.height };
    const handle = (resizeAction.invoker as OngoingInvoker).start(ctxAt(scene, corner, corner), undefined) as OngoingHandle;
    const boxes: RectPose[] = [];
    for (let i = 1; i <= 12; i++) {
      handle.onMove!(ctxAt(scene, corner, { x: corner.x + 3 * i, y: corner.y + 2 * i }));
      boxes.push({ ...boxOf(scene, TWEEN) });
    }
    handle.onEnd!(ctxAt(scene, corner, corner), 'cancel');

    // The steps are not an affine image of their sources, so the corner holds to within a pixel, not exactly.
    for (const b of boxes) {
      expect(Math.abs(b.x - start.x)).toBeLessThan(1);
      expect(Math.abs(b.y - start.y)).toBeLessThan(1);
    }
    for (let i = 1; i < boxes.length; i++) {
      expect(boxes[i]!.width).toBeGreaterThan(boxes[i - 1]!.width);
      expect(boxes[i]!.height).toBeGreaterThan(boxes[i - 1]!.height);
    }
  });
});

describe('rotating a node whose pose derives from its sources', () => {
  it('turns its sources about the center of its own box', () => {
    const scene = makeScene();
    const pivot = centerOf(boxOf(scene, TWEEN));
    const fromAt = centerOf(boxOf(scene, FROM));
    const at = (x: number, y: number) => ({
      world: { x, y }, screen: { x, y }, modifiers: KEYS,
      deps: { operands: { get: () => [TWEEN] as NodeId[] }, scene },
    }) as unknown as InvocationCtx;
    const handle = (rotateAction.invoker as OngoingInvoker).start(at(pivot.x + 100, pivot.y), undefined) as OngoingHandle;
    handle.onMove!(at(pivot.x, pivot.y + 100));
    handle.onEnd!(at(pivot.x, pivot.y + 100), 'commit');

    // A quarter turn clockwise on screen (y down) takes (dx, dy) about the pivot to (-dy, dx).
    const turned = centerOf(boxOf(scene, FROM));
    expect(turned.x).toBeCloseTo(pivot.x - (fromAt.y - pivot.y), 3);
    expect(turned.y).toBeCloseTo(pivot.y + (fromAt.x - pivot.x), 3);
  });
});
