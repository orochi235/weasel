import { describe, expect, it } from 'vitest';
import { warpSettingOf } from './warpParams';
import { freshWarp, withWarpSettings } from './warpTargets';
import type { HeldPathWarp } from './pathWarp';

const box = { x: 0, y: 0, width: 100, height: 100 };

describe('warp settings', () => {
  it('rejects a non-finite number for a number field', () => {
    expect(warpSettingOf('rows', NaN)).toBeNull();
    expect(warpSettingOf('tolerance', Infinity)).toBeNull();
    expect(warpSettingOf('rows', 4)).toEqual({ rows: 4 });
  });

  it('keeps a cloth warp\'s grid and tolerance when handed non-finite ones', () => {
    const warp = freshWarp('cloth', box, { rows: NaN, cols: 3 });
    expect(warp.kind === 'cloth' && [warp.mesh.rows, warp.mesh.cols]).toEqual([3, 3]);
    const held = { id: 'w', warp, tolerance: 0.5 } as unknown as HeldPathWarp;
    const next = withWarpSettings(held, { rows: NaN, cols: Infinity, tolerance: Infinity });
    expect(next).toBe(held);
  });
});
