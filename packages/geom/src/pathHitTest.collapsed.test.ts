import { describe, expect, it } from 'vitest';
import { strokeHitTest } from './pathHitTest';
import { pathFromD } from './paths/pathFromD';

describe('strokeHitTest under a collapsed view', () => {
  it('hits nothing when the slop transform has no scale', () => {
    const path = pathFromD('M0 0 L10 0');
    const slop = { px: 5, transform: [0, 0, 0, 0, 0, 0] as [number, number, number, number, number, number] };
    expect(strokeHitTest(path, 500, 500, 1, { slop })).toBe(false);
  });
});
