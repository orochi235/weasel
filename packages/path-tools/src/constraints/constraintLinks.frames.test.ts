import { describe, expect, it } from 'vitest';
import { PathBuilder, type PolygonPath } from '@weasel-js/geom';
import { createScene, type NodeId, type RectPose, type Scene } from '@weasel-js/core';
import { brokenConstraintLink, constraintLinkNode } from './constraintLinks';

type AnyScene = Scene<unknown, string, unknown>;

const line = (x0: number, y0: number, x1: number, y1: number): PolygonPath =>
  new PathBuilder().moveTo(x0, y0).lineTo(x1, y1).build() as PolygonPath;

describe('brokenConstraintLink in a group', () => {
  it('reads a grouped node where it draws', () => {
    const scene = createScene<object, 'main', RectPose>({ systemLayers: [{ id: 'main' }] });
    // A segment drawn from world (100, 0) to (100, 100), stored in a group at (90, 0).
    const group = scene.add({ kind: 'group', layer: 'main', data: {}, pose: { x: 90, y: 0, width: 20, height: 100 } });
    const inner = scene.add({ kind: 'mark', parent: group, layer: 'main', data: { path: line(0, 0, 0, 100) }, pose: { x: 10, y: 0, width: 0, height: 100 } });
    // A root segment whose anchor 0 sits on that drawn segment, at world (100, 50).
    const root = scene.add({ kind: 'mark', layer: 'main', data: { path: line(0, 0, 50, 0) }, pose: { x: 100, y: 50, width: 50, height: 0 } });
    const link = scene.add(constraintLinkNode<RectPose>({
      layer: 'main', nodes: [root, inner], constraint: { kind: 'onPath', anchor: 0, segment: [2, 3] },
    }) as never);
    expect(brokenConstraintLink(scene as unknown as AnyScene, link as NodeId)).toBeNull();
  });
});
