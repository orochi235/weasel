import { describe, expect, it } from 'vitest';
import { renderHook } from '@testing-library/react';
import { AUTO_POSE_DESCRIPTOR } from 'core/geometry/autoPoseDescriptor';
import { useSelectionOverlayLayer } from './useSelectionOverlayLayer';

const NONE: ReadonlySet<string> = new Set();
const build = (slot: Parameters<typeof useSelectionOverlayLayer>[0]) =>
  renderHook(() => useSelectionOverlayLayer(slot, () => NONE, AUTO_POSE_DESCRIPTOR as never)).result.current;

describe('useSelectionOverlayLayer', () => {
  it('builds the kit overlay from a config', () => {
    expect(build({ rotationHandle: true })).toMatchObject({
      layer: { space: 'screen' },
      rotationBadge: { distancePx: expect.any(Number) },
    });
  });

  it('builds nothing for a slot switched off', () => {
    expect(build(null)).toEqual({ layer: null, rotationBadge: null });
  });

  it('paints a pre-built layer in place of its own, with no rotate badge', () => {
    const layer = { id: 'mine', label: 'Mine', draw: () => [] };
    expect(build({ layer })).toEqual({ layer, rotationBadge: null });
  });
});
