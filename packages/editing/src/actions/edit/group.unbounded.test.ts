/**
 * Grouping members with no drawn bounds: the container still sits where its first member is drawn.
 */
import { describe, expect, it } from 'vitest';
import { createScene, scenePoseFrame, RECT_POSE_DESCRIPTOR } from '@weasel-js/core/engine';
import { asNodeId, type RectPose, type Scene } from '@weasel-js/core';
import type { ImmediateInvoker } from '@weasel-js/routing';
import { groupAction } from './group';

const P = asNodeId('p');
const A = asNodeId('a');

describe('group over members with no drawn bounds', () => {
  it('places the container at the first member in world space, inside a translated parent', () => {
    const scene = createScene<unknown, 'main', RectPose>({ systemLayers: [{ id: 'main' }] });
    scene.add({ id: P, kind: 'group', layer: 'main', data: {}, pose: { x: 100, y: 50, width: 200, height: 200 } });
    scene.add({ id: A, kind: 'mark', layer: 'main', parent: P, data: {}, pose: { x: 10, y: 20, width: 20, height: 20 } });
    const s = scene as unknown as Scene<unknown, string, unknown>;
    const before = scenePoseFrame(s).world(A) as RectPose;
    const unbounded = { ...RECT_POSE_DESCRIPTOR, getBounds: (p: RectPose) => ({ ...p, width: NaN }) };
    (groupAction.invoker as ImmediateInvoker).run({ scene: s, operands: { get: () => [A], set: () => {} }, poseDescriptor: unbounded } as never);
    const container = s.get(A)!.parent!;
    expect(container).not.toBe(P);
    const world = scenePoseFrame(s).world(container) as RectPose;
    expect({ x: world.x, y: world.y }).toEqual({ x: before.x, y: before.y });
    expect(scenePoseFrame(s).world(A)).toMatchObject({ x: before.x, y: before.y });
  });
});
