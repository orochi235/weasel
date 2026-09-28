import { describe, expect, it } from 'vitest';
import { resolveSpatialReference, type SpatialReferenceSources } from './spatialReference';
import type { NodeId } from 'core/scene/types';

const src = (pointer: { x: number; y: number } | null): SpatialReferenceSources => ({
  pointer: () => pointer,
  nodeBounds: (id) => (id === 'k' ? { x: 1, y: 2, width: 3, height: 4 } : null),
});

describe('resolveSpatialReference', () => {
  it('resolves the pointer to a zero-size rect, or null without one', () => {
    expect(resolveSpatialReference('pointer', src({ x: 5, y: 6 }))).toEqual({ x: 5, y: 6, width: 0, height: 0 });
    expect(resolveSpatialReference('pointer', src(null))).toBeNull();
  });

  it('takes a point as a zero-size rect and a rect as itself', () => {
    expect(resolveSpatialReference({ x: 1, y: 2 }, src(null))).toEqual({ x: 1, y: 2, width: 0, height: 0 });
    expect(resolveSpatialReference({ x: 1, y: 2, width: 3, height: 4 }, src(null)))
      .toEqual({ x: 1, y: 2, width: 3, height: 4 });
  });

  it("resolves a node to its bounds, and a missing one to null", () => {
    expect(resolveSpatialReference({ node: 'k' as NodeId }, src(null))).toEqual({ x: 1, y: 2, width: 3, height: 4 });
    expect(resolveSpatialReference({ node: 'gone' as NodeId }, src(null))).toBeNull();
  });

  it('answers null for a malformed value', () => {
    expect(resolveSpatialReference('elsewhere', src({ x: 0, y: 0 }))).toBeNull();
    expect(resolveSpatialReference({ x: '1', y: 2 }, src(null))).toBeNull();
  });
});
