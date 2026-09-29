import { describe, expect, it } from 'vitest';
import { matchAlignment, MOVE_ANCHORS } from './match';
import type { Guide } from '../types';

const tol = (n: number) => ({ x: n, y: n });

const box = { x: 100, y: 100, width: 50, height: 50 }; // L=100 cx=125 R=150

describe('matchAlignment', () => {
  it('snaps the left edge to a candidate within tolerance', () => {
    const cands: Guide[] = [{ id: 'a', axis: 'x', offset: 96 }];
    const m = matchAlignment(box, cands, tol(5), MOVE_ANCHORS);
    expect(m.dx).toBe(-4); // 96 - 100
    expect(m.activeX).toEqual(cands[0]);
    expect(m.dy).toBe(0);
    expect(m.activeY).toBeNull();
  });

  it('snaps the center when it is the closest feature', () => {
    const cands: Guide[] = [{ id: 'c', axis: 'x', offset: 123 }]; // near cx=125
    const m = matchAlignment(box, cands, tol(5), MOVE_ANCHORS);
    expect(m.dx).toBe(-2); // 123 - 125
    expect(m.activeX).toEqual(cands[0]);
  });

  it('snaps the right edge when it is the closest feature', () => {
    const cands: Guide[] = [{ id: 'r', axis: 'x', offset: 151 }]; // near R=150
    const m = matchAlignment(box, cands, tol(5), MOVE_ANCHORS);
    expect(m.dx).toBe(1); // 151 - 150
  });

  it('nearest candidate wins when several are in range', () => {
    const cands: Guide[] = [
      { id: 'far', axis: 'x', offset: 104 }, // 4 from L=100
      { id: 'near', axis: 'x', offset: 124 }, // 1 from cx=125
    ];
    const m = matchAlignment(box, cands, tol(6), MOVE_ANCHORS);
    expect(m.activeX!.id).toBe('near');
    expect(m.dx).toBe(-1);
  });

  it('resolves the two axes independently', () => {
    const cands: Guide[] = [
      { id: 'x', axis: 'x', offset: 100 }, // L exact
      { id: 'y', axis: 'y', offset: 98 }, // near T=100
    ];
    const m = matchAlignment(box, cands, tol(5), MOVE_ANCHORS);
    expect(m.dx).toBe(0);
    expect(m.activeX!.id).toBe('x');
    expect(m.dy).toBe(-2);
    expect(m.activeY!.id).toBe('y');
  });

  it('no match when all features are outside tolerance', () => {
    const cands: Guide[] = [{ id: 'a', axis: 'x', offset: 200 }];
    const m = matchAlignment(box, cands, tol(5), MOVE_ANCHORS);
    expect(m).toEqual({ dx: 0, dy: 0, activeX: null, activeY: null });
  });

  it('honors a restricted anchor set (resize: east edge only)', () => {
    const cands: Guide[] = [
      { id: 'l', axis: 'x', offset: 100 }, // would match L if 'min' allowed
      { id: 'r', axis: 'x', offset: 152 }, // matches R=150
    ];
    const m = matchAlignment(box, cands, tol(5), { x: ['max'], y: [] });
    expect(m.activeX!.id).toBe('r');
    expect(m.dx).toBe(2); // 152 - 150
  });
});

describe('per-axis tolerance', () => {
  const box = { x: 0, y: 0, width: 10, height: 10 };
  const anchors = { x: ['min'] as const, y: ['min'] as const };

  it('matches an x guide against the x tolerance alone', () => {
    const guides = [{ id: 'gx', axis: 'x' as const, offset: 3 }];
    expect(matchAlignment(box, guides, { x: 4, y: 1 }, anchors).activeX).not.toBeNull();
    expect(matchAlignment(box, guides, { x: 1, y: 4 }, anchors).activeX).toBeNull();
  });

  it('matches a y guide against the y tolerance alone', () => {
    const guides = [{ id: 'gy', axis: 'y' as const, offset: 3 }];
    expect(matchAlignment(box, guides, { x: 1, y: 4 }, anchors).activeY).not.toBeNull();
    expect(matchAlignment(box, guides, { x: 4, y: 1 }, anchors).activeY).toBeNull();
  });
});
