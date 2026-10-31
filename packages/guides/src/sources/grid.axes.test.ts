import { describe, expect, it } from 'vitest';
import { createScene, RIGID_POSE_COMPOSITION, type Bounds, type NodeId, type Scene } from '@weasel-js/core';
import type { GridSpacing } from '../grid/axes';
import { gridSnapSource } from './grid';
import { expectNear, moveBy } from './testing/session';

const BOX = { x: 0, y: 0, width: 4, height: 4 };

describe('gridSnapSource — a rule per axis', () => {
  it('snaps only the axis that has lines', () => {
    // Bottom edge 8.2 lands on 10; x is left alone.
    expectNear(moveBy({ sources: [gridSnapSource({ spacing: { y: 10 } })], box: BOX }).by(3.3, 4.2).point, { x: 3.3, y: 6 });
  });

  it('snaps onto explicit, uneven lines', () => {
    // Right edge 54 is a unit short of 55.
    const grid = gridSnapSource({ spacing: { x: { at: [0, 40, 55] } } });
    expectNear(moveBy({ sources: [grid], box: BOX }).by(50, 0).point, { x: 51, y: 0 });
  });

  it('runs a pitch through its offset, and has no line past its range', () => {
    const grid = gridSnapSource({ spacing: { x: { pitch: 10, offset: 3, from: 3, to: 23 } } });
    expectNear(moveBy({ sources: [grid], box: BOX }).by(5.5, 0).point, { x: 3, y: 0 });
    // Past `to`, the last line is the nearest there is.
    expectNear(moveBy({ sources: [grid], box: BOX }).by(40, 0).point, { x: 23, y: 0 });
  });

  it('lands declared anchors instead of the box', () => {
    const grid = gridSnapSource({ spacing: 10 });
    const big = { x: 0, y: 0, width: 30, height: 30 };
    expectNear(moveBy({ sources: [grid], box: big }).by(1, 1).point, { x: 0, y: 0 });
    // The anchor at (7, 7) is dragged to (8, 8), two short of the line.
    expectNear(moveBy({ sources: [grid], box: big, anchors: () => [{ x: 7, y: 7 }] }).by(1, 1).point, { x: 3, y: 3 });
  });
});

/** A container at `pose` with its own grid, holding `child`. */
function container(pose: Bounds & { transform?: readonly number[] }, own: GridSpacing | null, child: Bounds) {
  const scene = createScene<object, 'default', Bounds>({
    systemLayers: [{ id: 'default', visible: true, locked: false }], composition: RIGID_POSE_COMPOSITION,
  });
  const g = scene.add({ kind: 'group', layer: 'default', pose: pose as Bounds, data: {} }) as string;
  const inside = scene.add({ kind: 'mark', layer: 'default', parent: g as NodeId, pose: child, data: {} }) as string;
  return { scene: scene as unknown as Scene<unknown, string, unknown>, g, inside };
}

describe('gridSnapSource — a container\'s own grid', () => {
  it('snaps a child on its container\'s grid, from the container\'s corner', () => {
    const { scene, g, inside } = container({ x: 3, y: 3, width: 100, height: 100 }, 10, { x: 10, y: 10, width: 4, height: 4 });
    const grid = gridSnapSource({ spacing: 7, gridOf: (id) => (id === g ? 10 : undefined) });
    // Lines run 3, 13, 23…: the child's center, at world 15 moved by 8.5, is half a unit off 23.
    expectNear(moveBy({ sources: [grid], scene, ids: [inside] }).by(8.5, 8.5).point, { x: 8, y: 8 });
  });

  it('runs the grid through a scaled container, scale and all', () => {
    // Scaled 2× about its center: its corner lands at (-50, -50), and its 10-unit pitch is 20 in world.
    const { scene, g, inside } = container(
      { x: 0, y: 0, width: 100, height: 100, transform: [2, 0, 0, 2] }, 10, { x: 10, y: 10, width: 5, height: 5 },
    );
    const grid = gridSnapSource({ spacing: 7, gridOf: (id) => (id === g ? 10 : undefined) });
    // The child's world corner (-30, -30), moved by (18, 19), is near the line at -10.
    expectNear(moveBy({ sources: [grid], scene, ids: [inside] }).by(18, 19).point, { x: 20, y: 20 });
  });

  it('gives no grid inside a container whose grid is null', () => {
    const { scene, g, inside } = container({ x: 0, y: 0, width: 100, height: 100 }, null, { x: 10, y: 10, width: 4, height: 4 });
    const grid = gridSnapSource({ spacing: 10, gridOf: (id) => (id === g ? null : undefined) });
    expectNear(moveBy({ sources: [grid], scene, ids: [inside] }).by(3.3, 4.4).point, { x: 3.3, y: 4.4 });
  });

  it('leaves a container with no grid of its own to the one around it', () => {
    const { scene, inside } = container({ x: 3, y: 3, width: 100, height: 100 }, 10, { x: 10, y: 10, width: 4, height: 4 });
    const grid = gridSnapSource({ spacing: 10, gridOf: () => undefined });
    // On the root's lattice from world zero: the child's corner (13, 13) moved by 6 lands on 20.
    expectNear(moveBy({ sources: [grid], scene, ids: [inside] }).by(6, 6).point, { x: 7, y: 7 });
  });

  it('snaps nodes in two containers with different grids on neither', () => {
    const scene = createScene<object, 'default', Bounds>({ systemLayers: [{ id: 'default', visible: true, locked: false }] });
    const ids = [10, 20].map((pitch, i) => {
      const g = scene.add({ kind: 'group', layer: 'default', pose: { x: i * 200, y: 0, width: 100, height: 100 }, data: {} });
      return [g as string, pitch, scene.add({ kind: 'mark', layer: 'default', parent: g, pose: { x: 1, y: 1, width: 4, height: 4 }, data: {} }) as string] as const;
    });
    const grid = gridSnapSource({ spacing: 10, gridOf: (id) => ids.find(([g]) => g === id)?.[1] });
    const s = scene as unknown as Scene<unknown, string, unknown>;
    expect(moveBy({ sources: [grid], scene: s, ids: ids.map(([, , c]) => c) }).by(3.3, 4.4).point).toEqual({ x: 3.3, y: 4.4 });
  });
});
