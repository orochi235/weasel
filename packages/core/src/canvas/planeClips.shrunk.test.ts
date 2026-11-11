/**
 * Counterexamples the plane-clip property tests found, kept as plain examples.
 */
import { describe, expect, it } from 'vitest';
import type { DrawCommand } from '@weasel-js/renderer';
import type { Path } from '@weasel-js/geom';
import { IDENTITY_POSE_COMPOSITION } from 'core/scene/composeFrame';
import { createScene } from 'core/scene/scene';
import { asNodeId } from 'core/scene/types';
import { planeMap } from 'core/viewport/parallax';
import { buildSceneTree } from './buildSceneTree';
import { clipCarrier } from './planeClips';
import { sceneToAdapter } from './sceneAdapter';

describe('one clip object carried from two planes', () => {
  it('is carried from each plane, not served the first one’s answer', () => {
    const cam = { x: 0, y: 0, scale: { x: 0.25, y: 0.25 } };
    const maps = new Map([
      ['p0', planeMap(cam, { pan: 1, zoom: 0.1 })],
      ['p1', planeMap(cam, { pan: 0.1, zoom: 1 })],
      ['p2', planeMap(cam, { pan: 0.1, zoom: 0.10000000000000003 })],
    ]);
    const carry = clipCarrier((l) => maps.get(l) ?? null);
    const clip: Path = { kind: 'rect', x: 0, y: 0, width: 1, height: 1 };
    const fromP2 = carry(clip, 'p2', 'p0');
    const fromP1 = carry(clip, 'p1', 'p0');
    expect(fromP1).not.toEqual(fromP2);
    expect(fromP1).toEqual(clipCarrier((l) => maps.get(l) ?? null)(clip, 'p1', 'p0'));
  });

  it('clips each container’s children to its own plane’s copy in a scene build', () => {
    const CLIP: Path = { kind: 'rect', x: 0, y: 0, width: 100, height: 100 };
    const scene = createScene<null, 'near' | 'far' | 'top', unknown>({
      systemLayers: [{ id: 'near', parallax: { pan: 0.5 } }, { id: 'far', parallax: { pan: 0.25 } }, { id: 'top' }],
      composition: IDENTITY_POSE_COMPOSITION as never,
    });
    const pose = { x: 0, y: 0, width: 100, height: 100 };
    for (const layer of ['near', 'far'] as const) {
      scene.add({ id: asNodeId(layer), kind: 'group', layer, pose, data: null, clipFromPose: () => CLIP } as never);
      scene.add({ id: asNodeId(`${layer}.kid`), kind: 'mark', layer: 'top', parent: asNodeId(layer), pose, data: null } as never);
    }
    const clips = new Map<string, unknown>();
    const visit = (c: DrawCommand, clip: unknown): void => {
      if (c.kind === 'group') for (const k of (c as { children: DrawCommand[] }).children) visit(k, (c as { clip?: unknown }).clip ?? clip);
      else clips.set((c as unknown as { id: string }).id, clip);
    };
    const draw = (node: { id: string }) => [{ kind: 'marker', id: node.id } as unknown as DrawCommand];
    buildSceneTree(sceneToAdapter(scene) as never, draw as never, { x: 400, y: 0, scale: { x: 1, y: 1 } }).forEach((c) => visit(c, null));
    // Pan 0.5 and pan 0.25 put the same clip at different places in the camera's world.
    expect(clips.get('near.kid')).not.toEqual(clips.get('far.kid'));
  });
});
