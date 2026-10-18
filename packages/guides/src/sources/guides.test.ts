import { describe, expect, it } from 'vitest';
import type { Guide } from '../guides/types';
import { gridSnapSource } from './grid';
import { guideSnapSource } from './guides';
import { drive, expectNear, moveBy } from './testing/session';

const X100: Guide[] = [{ id: 'g', axis: 'x', offset: 100 }];
const ORIGIN = { x: 0, y: 0, width: 10, height: 10 };

describe('guideSnapSource', () => {
  it('is a target over origin and pointer probes', () => {
    const s = guideSnapSource(() => X100);
    expect(s.tier).toBeUndefined();
    expect(s.roles).toEqual(['origin', 'pointer']);
  });

  it('lands a moved origin on a guide in reach', () => {
    const out = moveBy({ sources: [guideSnapSource(() => X100)], box: ORIGIN, reachPx: 5 }).by(102, 50);
    expectNear(out.point, { x: 100, y: 50 });
    expect(out.held).toBe(true);
  });

  it('leaves a move alone past reach', () => {
    const out = moveBy({ sources: [guideSnapSource(() => X100)], box: ORIGIN, reachPx: 5 }).by(110, 50);
    expect(out).toMatchObject({ point: { x: 110, y: 50 }, held: false });
  });

  it('reaches the canvas\'s 8px by default, read through the view', () => {
    const at = (x: number, scale: number) =>
      moveBy({ sources: [guideSnapSource(() => X100)], box: ORIGIN, scale }).by(x, 0).point.x;
    expect(at(107, 1)).toBeCloseTo(100, 9);
    expect(at(109, 1)).toBe(109);
    // 4.5 world units is 9px at 2x; 4 is 2px at 0.5x.
    expect(at(104.5, 2)).toBe(104.5);
    expect(at(104, 0.5)).toBeCloseTo(100, 9);
  });

  it('reads the live guide list every frame', () => {
    let guides: Guide[] = [];
    const m = moveBy({ sources: [guideSnapSource(() => guides)], box: ORIGIN });
    expectNear(m.by(102, 50).point, { x: 102, y: 50 });
    guides = X100;
    expectNear(m.by(102, 50).point, { x: 100, y: 50 });
  });

  it('snaps a pointer on each axis independently', () => {
    const guides: Guide[] = [{ id: 'vx', axis: 'x', offset: 100 }, { id: 'hy', axis: 'y', offset: 50 }];
    expectNear(drive({ sources: [guideSnapSource(() => guides)] }).at({ x: 102, y: 48 }).point, { x: 100, y: 50 });
  });

  it('takes the nearer of two guides on one axis', () => {
    const guides: Guide[] = [{ id: 'a', axis: 'x', offset: 100 }, { id: 'b', axis: 'x', offset: 106 }];
    expect(drive({ sources: [guideSnapSource(() => guides)] }).at({ x: 104, y: 0 }).point.x).toBeCloseTo(106, 9);
  });

  it('beats the grid on its axis while the grid holds the other', () => {
    const sources = [gridSnapSource({ spacing: 10 }), guideSnapSource(() => [{ id: 'g', axis: 'x', offset: 103 }])];
    expectNear(drive({ sources }).at({ x: 101, y: 17 }).point, { x: 103, y: 20 });
  });

  it('meets a guide a move brings its origin near', () => {
    // A 10.5 drag puts the origin at 110.5, inside reach of the guide at 111.
    const box = { x: 100, y: 50, width: 20, height: 20 };
    const out = moveBy({ sources: [guideSnapSource(() => [{ id: 'g', axis: 'x', offset: 111 }])], box }).by(10.5, 0);
    expectNear(out.point, { x: 11, y: 0 });
  });

  it.todo('meets a camera guide with a node on a parallax plane (Task 6)');
});
