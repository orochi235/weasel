import { describe, expect, it } from 'vitest';
import { renderHook } from '@testing-library/react';
import type { DrawCommand, GroupDrawCommand } from '@weasel-js/renderer';
import { createScene } from 'core/scene/scene';
import { RECT_POSE_COMPOSITION } from 'core/scene/composePose';
import type { PoseRemoval } from 'core/scene/poseWrites';
import { asNodeId, type Node, type RectPose } from 'core/scene/types';
import type { View } from 'core/viewport/view';
import type { Departures, ShownDeparture } from '../../animation/departures';
import { useDepartureGhostLayer } from './useDepartureGhostLayer';

type N = Node<null, 'main', RectPose>;
const at = (x: number): RectPose => ({ x, y: 0, width: 10, height: 10 });
const VIEW: View = { x: 0, y: 0, scale: { x: 1, y: 1 } };

const drawOne = (_n: N, pose: RectPose): DrawCommand[] => [{
  kind: 'path',
  path: { kind: 'rect', x: pose.x, y: pose.y, width: pose.width, height: pose.height },
  fill: { paint: { color: '#000' } },
}];

function departing(shown: ShownDeparture<RectPose, N>[]): Departures<RectPose, N> {
  return { leave: () => {}, recall: () => undefined, shown: () => shown, subscribe: () => () => {}, dispose: () => {} };
}

const rectsIn = (cmds: readonly DrawCommand[]): number[] => cmds.flatMap((c) =>
  c.kind === 'group' ? rectsIn((c as GroupDrawCommand).children) : c.kind === 'path' && c.path.kind === 'rect' ? [c.path.x] : []);

function removal(node: N, pose: RectPose, children: PoseRemoval<RectPose, N>['children'] = []): PoseRemoval<RectPose, N> {
  return { id: node.id, parent: node.parent, node, pose, children, origin: 'call' };
}

describe('useDepartureGhostLayer', () => {
  it("draws each ghost through the scene slot's drawOne, at its pose and opacity, its descendants with it", () => {
    const scene = createScene<null, 'main', RectPose>({ systemLayers: [{ id: 'main' }] });
    const g = { id: asNodeId('g'), kind: 'group', layer: 'main', pose: at(0), data: null, parent: null, children: [] } as unknown as N;
    const k = { id: asNodeId('k'), kind: 'mark', layer: 'main', pose: at(4), data: null, parent: g.id } as unknown as N;
    const ghost = removal(g, at(30), [{ node: k, pose: at(4), children: [] }]);
    const { result } = renderHook(() => useDepartureGhostLayer({
      scene, sceneSlot: { drawOne }, departures: departing([{ removal: ghost, pose: at(30), alpha: 0.25 }]),
    }));
    const out = result.current.draw(undefined, VIEW, { width: 100, height: 100, dpr: 1 }) as DrawCommand[];
    expect(out).toHaveLength(1);
    expect(out[0]).toMatchObject({ kind: 'group', alpha: 0.25 });
    expect(rectsIn(out)).toEqual([30, 4]);
  });

  it('composes a ghost into the frame of a parent still in the scene, and its descendants into its own', () => {
    const scene = createScene<null, 'main', RectPose>({ systemLayers: [{ id: 'main' }], composition: RECT_POSE_COMPOSITION });
    const p = scene.add({ kind: 'group', layer: 'main', pose: at(100), data: null });
    const g = { id: asNodeId('g'), kind: 'group', layer: 'main', pose: at(0), data: null, parent: p, children: [] } as unknown as N;
    const k = { id: asNodeId('k'), kind: 'mark', layer: 'main', pose: at(4), data: null, parent: g.id } as unknown as N;
    const ghost = removal(g, at(30), [{ node: k, pose: at(4), children: [] }]);
    const { result } = renderHook(() => useDepartureGhostLayer({
      scene, sceneSlot: { drawOne }, departures: departing([{ removal: ghost, pose: at(30), alpha: 1 }]),
    }));
    expect(rectsIn(result.current.draw(undefined, VIEW, { width: 100, height: 100, dpr: 1 }) as DrawCommand[])).toEqual([130, 134]);
  });

  it('draws nothing with no ghost leaving', () => {
    const scene = createScene<null, 'main', RectPose>({ systemLayers: [{ id: 'main' }] });
    const { result } = renderHook(() => useDepartureGhostLayer({ scene, sceneSlot: { drawOne }, departures: departing([]) }));
    expect(result.current.draw(undefined, VIEW, { width: 100, height: 100, dpr: 1 })).toEqual([]);
  });
});
