import { describe, expect, it, vi } from 'vitest';
import { encodeResolve, type WgpuTarget } from './wgpuTargets';
import type { ResourceHost } from './wgpuResources';

function target(width: number, height: number): WgpuTarget {
  return { width, height, msaa: null, color: { gpu: { width, height } } } as unknown as WgpuTarget;
}

function copies(source: WgpuTarget, dest: WgpuTarget, width: number, height: number, x: number, y: number) {
  const copy = vi.fn();
  encodeResolve({} as ResourceHost, { copyTextureToTexture: copy } as unknown as GPUCommandEncoder, source, dest, width, height, x, y);
  return copy.mock.calls.map(([from, to, size]) => ({ from: from.origin, to: to.origin, size }));
}

describe('encodeResolve', () => {
  it('copies a rect inside both targets as asked, rows counted from the bottom', () => {
    expect(copies(target(8, 8), target(16, 16), 4, 2, 3, 5)).toEqual([{ from: [0, 6], to: [3, 9], size: [4, 2] }]);
  });

  it('clips to both targets as WebGL blitting does, rather than encoding a copy that voids the submit', () => {
    // Past the destination's right and top edges.
    expect(copies(target(8, 8), target(10, 10), 6, 6, 7, 6)).toEqual([{ from: [0, 4], to: [7, 0], size: [3, 4] }]);
    // Larger than the source, at a negative offset.
    expect(copies(target(4, 4), target(10, 10), 6, 6, -1, -2)).toEqual([{ from: [1, 0], to: [0, 8], size: [3, 2] }]);
  });

  it('copies nothing for a rect wholly outside the destination', () => {
    expect(copies(target(8, 8), target(8, 8), 4, 4, 8, 0)).toEqual([]);
  });
});
