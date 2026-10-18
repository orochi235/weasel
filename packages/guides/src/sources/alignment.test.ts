import { describe, expect, it } from 'vitest';
import { createScene, type Bounds, type Scene, type SnapMark } from '@weasel-js/core';
import type { Guide } from '../guides/types';
import { alignmentSnapSource } from './alignment';
import { gridSnapSource } from './grid';
import { drive, expectNear, moveBy } from './testing/session';

type Pose = Bounds & { rotation?: number };

function sceneOf(poses: readonly Pose[]) {
  const scene = createScene<object, 'default', Pose>({ systemLayers: [{ id: 'default', visible: true, locked: false }] });
  const ids = poses.map((pose) => scene.add({ kind: 'leaf', layer: 'default', pose, data: {} }) as string);
  return { scene: scene as unknown as Scene<unknown, string, unknown>, ids };
}

const lines = (cands: readonly Guide[]) => alignmentSnapSource({ getCandidates: () => cands });
const BOX: Bounds = { x: 100, y: 100, width: 50, height: 50 };

describe('alignmentSnapSource', () => {
  it('is a target over box and pointer probes', () => {
    expect(alignmentSnapSource()).toMatchObject({ id: 'alignment', roles: ['box', 'pointer'] });
    expect(alignmentSnapSource().tier).toBeUndefined();
  });

  it('lands the box edge on a line in reach, and marks it', () => {
    const out = moveBy({ sources: [lines([{ id: 'L', axis: 'x', offset: 96 }])], box: BOX, reachPx: 5 }).by(0, 0);
    expectNear(out.point, { x: -4, y: 0 });
    expect(out.marks).toEqual([{ kind: 'line', from: { x: 96, y: 100 }, to: { x: 96, y: 150 } }]);
  });

  it('reads reach in screen px through the view', () => {
    const at = (scale: number) =>
      moveBy({ sources: [lines([{ id: 'L', axis: 'x', offset: 96 }])], box: BOX, reachPx: 5, scale }).by(0, 0).point.x;
    // 4 world units is 8px at 2x, 2px at 0.5x.
    expect(at(2)).toBe(0);
    expect(at(0.5)).toBeCloseTo(-4, 9);
  });

  it('leaves the box alone and draws nothing on a miss', () => {
    const out = moveBy({ sources: [lines([{ id: 'L', axis: 'x', offset: 300 }])], box: BOX }).by(0, 0);
    expect(out).toMatchObject({ point: { x: 0, y: 0 }, held: false, marks: [] });
  });

  it('matches the union box of a selection, edges and center', () => {
    // A at x 100..150 and B at 180..260: the union runs 100..260, centered on 180.
    const union: Bounds = { x: 100, y: 100, width: 160, height: 50 };
    expect(moveBy({ sources: [lines([{ id: 'ur', axis: 'x', offset: 262 }])], box: union }).by(0, 0).point.x).toBeCloseTo(2, 9);
    expect(moveBy({ sources: [lines([{ id: 'uc', axis: 'x', offset: 181 }])], box: union }).by(0, 0).point.x).toBeCloseTo(1, 9);
  });

  it('snaps an inserted point to a line', () => {
    const out = drive({ sources: [lines([{ id: 'gx', axis: 'x', offset: 200 }])], reachPx: 5 }).at({ x: 197, y: 80 });
    expectNear(out.point, { x: 200, y: 80 });
  });

  it('snaps a resize\'s moving edge to a line', () => {
    // The east edge of 100..150 is the pointer probe; the west edge stays put.
    const edge = { x: 150, y: 125 };
    const out = drive({
      sources: [lines([{ id: 'r', axis: 'x', offset: 152 }])], gesture: 'resize', press: edge, reachPx: 5,
    }).at(edge);
    expectNear(out.point, { x: 152, y: 125 });
  });

  it('beats the grid on its axis while the grid holds the other', () => {
    const sources = [gridSnapSource({ spacing: 10 }), lines([{ id: 'L', axis: 'x', offset: 96 }])];
    // Before the snap pipeline the grid rounded x to 100 and alignment then moved it again.
    expectNear(moveBy({ sources, box: BOX }).by(0, 7).point, { x: -4, y: 10 });
  });

  it('aligns to a page box', () => {
    const page: Bounds = { x: 0, y: 0, width: 500, height: 500 };
    const out = moveBy({ sources: [alignmentSnapSource({ page: () => page })], box: { x: 3, y: 200, width: 10, height: 10 } }).by(0, 0);
    expectNear(out.point, { x: -3, y: 0 });
  });

  describe('over a scene', () => {
    it('aligns to the subject\'s siblings, and marks the line out to the farthest one', () => {
      const { scene, ids } = sceneOf([
        { x: 0, y: 0, width: 20, height: 20 },
        { x: 0, y: 100, width: 20, height: 20 },
        { x: 2, y: 300, width: 20, height: 20 },
      ]);
      const out = moveBy({
        sources: [alignmentSnapSource({ color: '#e0397f' })], box: { x: 2, y: 300, width: 20, height: 20 },
        ids: [ids[2]], scene,
      }).by(-1, 5);
      expectNear(out.point, { x: -2, y: 5 });
      // At the snapped position the box spans y 305..325, below both siblings.
      expect(out.marks).toContainEqual({ kind: 'line', from: { x: 0, y: 0 }, to: { x: 0, y: 325 }, color: '#e0397f' });
      expect(out.marks.every((m: SnapMark) => m.kind === 'line' && m.color === '#e0397f')).toBe(true);
    });

    it('matches a rotated selection against a rotated sibling, ink to ink', () => {
      // 40x10 at a quarter turn: the sibling's ink spans x 55..65, the
      // dragged one's 115..125. A -48 drag puts its left edge at 67.
      const { scene, ids } = sceneOf([
        { x: 40, y: 0, width: 40, height: 10, rotation: Math.PI / 2 },
        { x: 100, y: 100, width: 40, height: 10, rotation: Math.PI / 2 },
      ]);
      const ink: Bounds = { x: 115, y: 85, width: 10, height: 40 };
      const out = moveBy({ sources: [alignmentSnapSource()], box: ink, ids: [ids[1]], scene }).by(-48, 0);
      expect(out.point.x).toBeCloseTo(-50, 9);
    });

    it('lines up a point gesture with the top-level nodes', () => {
      const { scene } = sceneOf([{ x: 0, y: 0, width: 20, height: 20 }]);
      expectNear(drive({ sources: [alignmentSnapSource()], scene }).at({ x: 23, y: 50 }).point, { x: 20, y: 50 });
    });
  });
});
