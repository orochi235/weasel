/**
 * Pick slop under non-uniform zoom on a rotated node.
 *
 * The slop is a screen distance, so a pointer `pickTolerancePx` pixels off any
 * edge — measured on screen, along that edge's on-screen normal — is in, and
 * one a little farther is out, whatever the zoom does to each axis.
 */
import { describe, it, expect } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useScene } from 'core/scene/useScene';
import type { UseSceneOptions } from 'core/scene/types';
import { useSceneAdapter } from 'canvas/sceneAdapter';
import { asNodeId } from 'core/scene/types';
import { useSceneSelectTool, DEFAULT_PICK_TOLERANCE_PX } from './useSceneSelectTool';

type Pose = { x: number; y: number; width: number; height: number; rotation?: number };
interface Item { color?: string }

const POSE: Pose = { x: 0, y: 0, width: 40, height: 20, rotation: Math.PI / 6 };
const SCALE = { x: 4, y: 1 };

/** Points `d` screen px outside each edge's midpoint, in world coords. */
function offEdges(pose: Pose, scale: { x: number; y: number }, d: number) {
  const cx = pose.x + pose.width / 2;
  const cy = pose.y + pose.height / 2;
  const cos = Math.cos(pose.rotation ?? 0);
  const sin = Math.sin(pose.rotation ?? 0);
  const corners = [
    [pose.x, pose.y], [pose.x + pose.width, pose.y],
    [pose.x + pose.width, pose.y + pose.height], [pose.x, pose.y + pose.height],
  ].map(([x, y]) => {
    const dx = x - cx, dy = y - cy;
    return [(cx + cos * dx - sin * dy) * scale.x, (cy + sin * dx + cos * dy) * scale.y];
  });
  const sc = [cx * scale.x, cy * scale.y];
  return corners.map((a, i) => {
    const b = corners[(i + 1) % 4];
    const mx = (a[0] + b[0]) / 2, my = (a[1] + b[1]) / 2;
    let nx = -(b[1] - a[1]), ny = b[0] - a[0];
    const l = Math.hypot(nx, ny);
    nx /= l; ny /= l;
    if (nx * (mx - sc[0]) + ny * (my - sc[1]) < 0) { nx = -nx; ny = -ny; }
    return { x: (mx + nx * d) / scale.x, y: (my + ny * d) / scale.y };
  });
}

function harness(picking: 'pose' | 'shape') {
  const initial: UseSceneOptions<Item, 'default', Pose>['initial'] = [{
    id: asNodeId('n'), kind: 'leaf', layer: 'default', pose: POSE, data: { color: '#abc' },
  }];
  const { result } = renderHook(() => {
    const scene = useScene<Item, 'default', Pose>({ systemLayers: [{ id: 'default' }], initial });
    const adapter = useSceneAdapter(scene);
    return useSceneSelectTool({ scene, adapter, geometry: { picking } });
  });
  return (p: { x: number; y: number }) => result.current.pickEvery(p.x, p.y, { scale: SCALE });
}

describe.each(['pose', 'shape'] as const)('pick slop under 4:1 zoom, rotated node (%s)', (picking) => {
  const tol = DEFAULT_PICK_TOLERANCE_PX;

  it('takes a pointer just inside the slop off every edge', () => {
    const pick = harness(picking);
    for (const p of offEdges(POSE, SCALE, tol - 0.5)) expect(pick(p)).toEqual(['n']);
  });

  it('refuses a pointer just outside the slop off every edge', () => {
    const pick = harness(picking);
    for (const p of offEdges(POSE, SCALE, tol + 0.5)) expect(pick(p)).toEqual([]);
  });
});

// An outline-only rect stroked 8px wide: the ink reaches 4px past the edge and
// the slop 4px more, on screen, so 8px off the left edge across x and 8px off
// the top edge down y — and nothing in its empty middle.
describe('picking a { px } outline under 4:1 zoom', () => {
  const pose: Pose = { x: 0, y: 0, width: 40, height: 20 };
  function outline() {
    const initial: UseSceneOptions<Item, 'default', Pose>['initial'] = [{
      id: asNodeId('n'), kind: 'leaf', layer: 'default', pose,
      data: {
        path: { kind: 'rect', x: 0, y: 0, width: 40, height: 20 },
        fill: null,
        stroke: { paint: { color: '#000' }, width: { px: 8 } },
      } as Item,
    }];
    const { result } = renderHook(() => {
      const scene = useScene<Item, 'default', Pose>({ systemLayers: [{ id: 'default' }], initial });
      const adapter = useSceneAdapter(scene);
      return useSceneSelectTool({ scene, adapter });
    });
    return (x: number, y: number) => result.current.pickEvery(x, y, { scale: SCALE });
  }

  it('takes a pointer just inside the reach across and down', () => {
    const pick = outline();
    expect(pick(-7.5 / SCALE.x, 10)).toEqual(['n']);
    expect(pick(20, -7.5 / SCALE.y)).toEqual(['n']);
  });

  it('refuses a pointer just outside it, and one in the middle', () => {
    const pick = outline();
    expect(pick(-8.5 / SCALE.x, 10)).toEqual([]);
    expect(pick(20, -8.5 / SCALE.y)).toEqual([]);
    expect(pick(20, 10)).toEqual([]);
  });
});
