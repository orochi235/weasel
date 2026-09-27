import { describe, expect, it } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useViewHelpers } from './useViewHelpers';
import { RECT_POSE_DESCRIPTOR } from 'core/geometry/poseDescriptor';
import { asNodeId } from 'core/scene/types';
import { createCornerResizeAffordance } from 'affordances/cornerResize';
import type { Bounds } from 'core/viewport/fitViewToBounds';

describe('useViewHelpers chrome state', () => {
  // A committed move changes poses in the adapter without changing the
  // selection, the adapter, or the geometry, so nothing the chrome state is
  // memoized on moves. The union the corner handles are built from has to
  // follow the poses anyway.
  it('multi-select handles follow a committed group move', () => {
    const poses: Record<string, Bounds> = {
      a: { x: 0, y: 0, width: 10, height: 10 },
      b: { x: 40, y: 20, width: 10, height: 10 },
    };
    const adapter = { getPose: (id: string) => poses[id] };
    const selection = [asNodeId('a'), asNodeId('b')];
    const opts = {
      adapter,
      geometry: RECT_POSE_DESCRIPTOR,
      boundsOf: undefined,
      selection,
      tools: undefined,
      gestureSource: undefined,
      previewPoseExtra: undefined,
      previewIdsExtra: undefined,
    };
    const { result, rerender } = renderHook((o) => useViewHelpers(o), { initialProps: opts });
    const corners = createCornerResizeAffordance();
    const cornerAt = (tag: string) => {
      const r = corners.regions(result.current.chromeState).find((x) => x.id === `corner-${tag}`);
      return r && r.shape.kind === 'point' ? { x: r.shape.x, y: r.shape.y } : null;
    };

    expect(result.current.chromeState.unionBounds).toEqual({ x: 0, y: 0, width: 50, height: 30 });
    const seBefore = cornerAt('max-max');

    poses.a = { x: 100, y: 100, width: 10, height: 10 };
    poses.b = { x: 140, y: 120, width: 10, height: 10 };
    rerender(opts);

    expect(result.current.chromeState.unionBounds).toEqual({ x: 100, y: 100, width: 50, height: 30 });
    expect(cornerAt('max-max')).toEqual({ x: seBefore!.x + 100, y: seBefore!.y + 100 });
  });
});
