import { describe, it, expect } from 'vitest';
import { edgeHandlesFit } from './resizeHandles';
import { IDENTITY_TARGET, type TargetTransform } from 'core/geometry/targetFrame';

const ONE = { x: 1, y: 1 };

describe('edgeHandlesFit', () => {
  it('fits a body whose sides span six hit radii on screen', () => {
    expect(edgeHandlesFit({ width: 48, height: 48 }, IDENTITY_TARGET, ONE, 8)).toBe(true);
    expect(edgeHandlesFit({ width: 47, height: 48 }, IDENTITY_TARGET, ONE, 8)).toBe(false);
  });

  it('does not fit a body its frame collapses', () => {
    const flat: TargetTransform = { identity: false, toWorld: [1, 0, 0, 0, 0, 0], toLocal: null };
    expect(edgeHandlesFit({ width: 100, height: 100 }, flat, ONE, 8)).toBe(false);
  });
});
