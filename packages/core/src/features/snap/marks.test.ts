import { describe, expect, it } from 'vitest';
import { distinct } from './marks';
import type { SnapMark } from './types';

describe('distinct', () => {
  it('drops a mark equal to an earlier one and keeps one that differs in any field', () => {
    const line: SnapMark = { kind: 'line', from: { x: 0, y: 0 }, to: { x: 0, y: 10 } };
    const again: SnapMark = { kind: 'line', from: { x: 0, y: 0 }, to: { x: 0, y: 10 } };
    const other: SnapMark = { kind: 'line', from: { x: 0, y: 0 }, to: { x: 0, y: 10 }, color: '#f00' };
    const point: SnapMark = { kind: 'point', at: { x: 0, y: 10 }, glyph: 'anchor' };
    expect(distinct([line, point, again, other, point])).toEqual([line, point, other]);
  });
});
